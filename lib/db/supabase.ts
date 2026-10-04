import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DuplicateCodeError, type ClinicRow, type FlagRow, type NewClinic, type NewFlag, type NewPlan, type NewSession, type PlanRow, type SessionRow, type Store } from "./types";

function check<T>(res: { data: T; error: { code?: string; message: string } | null }): T {
  if (res.error) throw new Error(`database: ${res.error.message}`);
  return res.data;
}

/** Postgres dates come back as "YYYY-MM-DD"; keep them as strings. */
export class SupabaseStore implements Store {
  private db: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listClinics() {
    return check(await this.db.from("clinics").select("*").order("code")) as ClinicRow[];
  }
  async getClinic(id: string) {
    return check(await this.db.from("clinics").select("*").eq("id", id).maybeSingle()) as ClinicRow | null;
  }
  async getClinicByCode(code: string) {
    return check(await this.db.from("clinics").select("*").eq("code", code).maybeSingle()) as ClinicRow | null;
  }
  async insertClinic(c: NewClinic) {
    const res = await this.db.from("clinics").insert(c).select("*").single();
    if (res.error?.code === "23505") throw new DuplicateCodeError(c.code);
    return check(res) as ClinicRow;
  }
  async updateClinicSettings(id: string, settings: ClinicRow["settings"]) {
    check(await this.db.from("clinics").update({ settings }).eq("id", id));
  }

  async insertPlan(p: NewPlan) {
    const res = await this.db.from("plans").insert(p).select("*").single();
    if (res.error?.code === "23505") throw new DuplicateCodeError(p.code);
    return check(res) as PlanRow;
  }
  async getPlanByCode(code: string) {
    return check(await this.db.from("plans").select("*").eq("code", code).maybeSingle()) as PlanRow | null;
  }
  async updatePlan(id: string, patch: Partial<PlanRow>) {
    check(await this.db.from("plans").update(patch).eq("id", id));
  }
  async listPlans(filter: { clinicId?: string } = {}) {
    let q = this.db.from("plans").select("*");
    if (filter.clinicId) q = q.eq("clinic_id", filter.clinicId);
    return check(await q) as PlanRow[];
  }

  async insertSession(s: NewSession) {
    const existing = check(
      await this.db.from("sessions").select("*").eq("plan_id", s.plan_id).eq("client_id", s.client_id).maybeSingle(),
    ) as SessionRow | null;
    if (existing) return { row: existing, created: false };
    const res = await this.db.from("sessions").insert(s).select("*").single();
    if (res.error?.code === "23505") {
      const again = check(await this.db.from("sessions").select("*").eq("plan_id", s.plan_id).eq("client_id", s.client_id).single());
      return { row: again as SessionRow, created: false };
    }
    return { row: check(res) as SessionRow, created: true };
  }
  async listSessions(filter: { planIds?: string[] } = {}) {
    let q = this.db.from("sessions").select("*");
    if (filter.planIds) q = q.in("plan_id", filter.planIds.length ? filter.planIds : ["00000000-0000-0000-0000-000000000000"]);
    return check(await q) as SessionRow[];
  }

  async insertFlags(f: NewFlag[]) {
    if (!f.length) return [];
    return check(await this.db.from("flags").insert(f).select("*")) as FlagRow[];
  }
  async listFlags(filter: { planIds?: string[] } = {}) {
    let q = this.db.from("flags").select("*");
    if (filter.planIds) q = q.in("plan_id", filter.planIds.length ? filter.planIds : ["00000000-0000-0000-0000-000000000000"]);
    return check(await q) as FlagRow[];
  }
  async acknowledgeFlag(id: string, clinicId: string, at: string) {
    const flag = check(await this.db.from("flags").select("id, plan_id").eq("id", id).maybeSingle()) as { plan_id: string } | null;
    if (!flag) return false;
    const plan = check(await this.db.from("plans").select("clinic_id").eq("id", flag.plan_id).maybeSingle()) as { clinic_id: string } | null;
    if (!plan || plan.clinic_id !== clinicId) return false;
    check(await this.db.from("flags").update({ acknowledged_at: at }).eq("id", id));
    return true;
  }

  async deletePlanData(planId: string) {
    check(await this.db.from("flags").delete().eq("plan_id", planId));
    check(await this.db.from("sessions").delete().eq("plan_id", planId));
  }
  async purgeClosedBefore(isoDate: string) {
    const old = check(await this.db.from("plans").select("id").lt("closed_at", isoDate)) as { id: string }[];
    if (old.length) check(await this.db.from("plans").delete().in("id", old.map((o) => o.id)));
    return old.length;
  }
  async resetAll() {
    check(await this.db.from("clinics").delete().neq("code", "")); // cascades to plans, sessions, flags
  }
}
