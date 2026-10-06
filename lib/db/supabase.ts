import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DuplicateCodeError, type ClinicRow, type FlagRow, type NewClinic, type NewFlag, type NewPlan, type NewSession, type PlanRow, type SessionRow, type Store } from "./types";

type DbError = { code?: string; message: string };

function check<T>(res: { data: T; error: DbError | null }): T {
  if (res.error) throw new Error(`database: ${res.error.message}`);
  return res.data;
}

export const PAGE = 1000; // Supabase returns at most this many rows per request (API "max rows" default)
const IN_CHUNK = 100; // ids per .in() filter, so the request URL stays short

/**
 * Every row, not only the first PAGE. `page(afterId)` returns up to PAGE rows with id > afterId, in id order.
 * Paging by id (not offset) means a row written meanwhile is never counted twice or skipped.
 */
export async function allRows<T extends { id: string }>(page: (afterId: string | null) => PromiseLike<{ data: unknown[] | null; error: DbError | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let after: string | null = null; ; ) {
    const rows = (check(await page(after)) ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
    after = rows[rows.length - 1].id;
  }
}

export function chunks<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

type Query = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

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
    const clinicId = filter.clinicId;
    return allRows<PlanRow>((after) => this.page("plans", after, (q) => (clinicId ? q.eq("clinic_id", clinicId) : q)));
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
    return this.byPlan<SessionRow>("sessions", filter.planIds);
  }

  async insertFlags(f: NewFlag[]) {
    if (!f.length) return [];
    return check(await this.db.from("flags").insert(f).select("*")) as FlagRow[];
  }
  async listFlags(filter: { planIds?: string[] } = {}) {
    return this.byPlan<FlagRow>("flags", filter.planIds);
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
    const old = await allRows<{ id: string }>((after) => this.page("plans", after, (q) => q.lt("closed_at", isoDate), "id"));
    for (const ids of chunks(old.map((o) => o.id), IN_CHUNK)) check(await this.db.from("plans").delete().in("id", ids));
    return old.length;
  }
  async deletePlansByCode(codes: string[]) {
    let n = 0;
    for (const part of chunks(codes, IN_CHUNK)) {
      n += (check(await this.db.from("plans").delete().in("code", part).select("id")) as { id: string }[]).length; // cascades to sessions, flags
    }
    return n;
  }
  async resetAll() {
    check(await this.db.from("clinics").delete().neq("code", "")); // cascades to plans, sessions, flags
  }

  /** One page of a table in id order, for allRows; `where` adds the filters. */
  private page(table: string, after: string | null, where: (q: Query) => Query = (q) => q, columns = "*") {
    let q = where(this.db.from(table).select(columns));
    if (after) q = q.gt("id", after);
    return q.order("id").limit(PAGE);
  }

  /** Sessions or flags of the given plans (all when no list): the ids go in chunks of IN_CHUNK per request. */
  private async byPlan<T extends { id: string }>(table: "sessions" | "flags", planIds?: string[]): Promise<T[]> {
    if (!planIds) return allRows<T>((after) => this.page(table, after));
    const out: T[] = [];
    for (const ids of chunks([...new Set(planIds)], IN_CHUNK)) {
      out.push(...(await allRows<T>((after) => this.page(table, after, (q) => q.in("plan_id", ids)))));
    }
    return out;
  }
}
