import { randomUUID } from "node:crypto";
import { DuplicateCodeError, type ClinicRow, type FlagRow, type NewClinic, type NewFlag, type NewPlan, type NewSession, type PlanRow, type SessionRow, type Store } from "./types";

/** In-memory store for tests and for running locally before Supabase is set up. */
export class MemoryStore implements Store {
  clinics: ClinicRow[] = [];
  plans: PlanRow[] = [];
  sessions: SessionRow[] = [];
  flags: FlagRow[] = [];
  private now = () => new Date().toISOString();

  async listClinics() {
    return [...this.clinics];
  }
  async getClinic(id: string) {
    return this.clinics.find((c) => c.id === id) ?? null;
  }
  async getClinicByCode(code: string) {
    return this.clinics.find((c) => c.code === code) ?? null;
  }
  async insertClinic(c: NewClinic) {
    if (this.clinics.some((x) => x.code === c.code)) throw new DuplicateCodeError(c.code);
    const row: ClinicRow = { ...c, id: randomUUID(), created_at: this.now() };
    this.clinics.push(row);
    return row;
  }
  async updateClinicSettings(id: string, settings: ClinicRow["settings"]) {
    const c = this.clinics.find((x) => x.id === id);
    if (c) c.settings = settings;
  }

  async insertPlan(p: NewPlan) {
    if (this.plans.some((x) => x.code === p.code)) throw new DuplicateCodeError(p.code);
    const row: PlanRow = { ...p, id: randomUUID(), status: "active", consent_at: null, closed_at: null, created_at: this.now() };
    this.plans.push(row);
    return row;
  }
  async getPlanByCode(code: string) {
    return this.plans.find((p) => p.code === code) ?? null;
  }
  async updatePlan(id: string, patch: Partial<PlanRow>) {
    const p = this.plans.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  }
  async listPlans(filter: { clinicId?: string } = {}) {
    return this.plans.filter((p) => !filter.clinicId || p.clinic_id === filter.clinicId);
  }

  async insertSession(s: NewSession) {
    const existing = this.sessions.find((x) => x.plan_id === s.plan_id && x.client_id === s.client_id);
    if (existing) return { row: existing, created: false };
    const row: SessionRow = { ...s, id: randomUUID(), created_at: this.now() };
    this.sessions.push(row);
    return { row, created: true };
  }
  async listSessions(filter: { planIds?: string[] } = {}) {
    return this.sessions.filter((s) => !filter.planIds || filter.planIds.includes(s.plan_id));
  }

  async insertFlags(f: NewFlag[]) {
    const rows = f.map((x) => ({ ...x, id: randomUUID(), created_at: this.now(), acknowledged_at: null }));
    this.flags.push(...rows);
    return rows;
  }
  async listFlags(filter: { planIds?: string[] } = {}) {
    return this.flags.filter((f) => !filter.planIds || filter.planIds.includes(f.plan_id));
  }
  async acknowledgeFlag(id: string, clinicId: string, at: string) {
    const f = this.flags.find((x) => x.id === id);
    const plan = f && this.plans.find((p) => p.id === f.plan_id);
    if (!f || !plan || plan.clinic_id !== clinicId) return false;
    f.acknowledged_at = at;
    return true;
  }

  async deletePlanData(planId: string) {
    this.sessions = this.sessions.filter((s) => s.plan_id !== planId);
    this.flags = this.flags.filter((f) => f.plan_id !== planId);
  }
  async purgeClosedBefore(isoDate: string) {
    const old = this.plans.filter((p) => p.closed_at !== null && p.closed_at < isoDate).map((p) => p.id);
    for (const id of old) await this.deletePlanData(id);
    this.plans = this.plans.filter((p) => !old.includes(p.id));
    return old.length;
  }
  async resetAll() {
    this.clinics = [];
    this.plans = [];
    this.sessions = [];
    this.flags = [];
  }
}
