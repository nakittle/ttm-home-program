import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/db";
import { MemoryStore } from "@/lib/db/memory";
import { allRows, SupabaseStore } from "@/lib/db/supabase";

describe("getStore", () => {
  beforeEach(() => {
    resetStoreForTests();
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("ALLOW_MEMORY_STORE", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetStoreForTests();
  });

  it("throws in production when Supabase is not configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getStore()).toThrow("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co"); // key still missing
    expect(() => getStore()).toThrow(/Supabase is not configured/);
  });

  it("allows the memory store in production only with ALLOW_MEMORY_STORE=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_MEMORY_STORE", "1");
    expect(getStore()).toBeInstanceOf(MemoryStore);
  });

  it("uses the memory store outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getStore()).toBeInstanceOf(MemoryStore);
  });

  it("uses Supabase when configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    expect(getStore()).toBeInstanceOf(SupabaseStore);
  });
});

describe("MemoryStore flags", () => {
  it("skips a duplicate (session_id, rule_id) like the unique constraint", async () => {
    const s = new MemoryStore();
    const f = { plan_id: "p1", session_id: "s1", rule_id: "RF04", level: "stop_and_contact_clinic" as const, posture_id: null };
    expect(await s.insertFlags([f, { ...f, rule_id: "RF09", level: "note_for_next_visit" as const }])).toHaveLength(2);
    expect(await s.insertFlags([f])).toHaveLength(0);
    expect(await s.insertFlags([f, f])).toHaveLength(0);
    expect(s.flags).toHaveLength(2);
    expect(await s.insertFlags([{ ...f, session_id: "s2" }])).toHaveLength(1);
  });
});

type Row = { id: string } & Record<string, unknown>;

/** Stand-in for the Supabase query builder. Like Supabase it returns at most 1000 rows per request. */
function fakeSupabase(tables: Record<string, Row[]>) {
  const requests: { table: string; ids?: number }[] = [];
  const from = (table: string) => {
    const req: { table: string; ids?: number } = { table };
    requests.push(req);
    let rows = [...tables[table]];
    let limit = 1000;
    let del = false;
    const q = {
      select: () => q,
      delete: () => ((del = true), q),
      eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), q),
      lt: (c: string, v: string) => ((rows = rows.filter((r) => r[c] !== null && String(r[c]) < v)), q),
      gt: (c: string, v: string) => ((rows = rows.filter((r) => String(r[c]) > v)), q),
      in: (c: string, vs: unknown[]) => ((req.ids = vs.length), (rows = rows.filter((r) => vs.includes(r[c]))), q),
      order: (c: string) => ((rows = [...rows].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1))), q),
      limit: (n: number) => ((limit = Math.min(n, 1000)), q),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
        if (del) tables[table] = tables[table].filter((r) => !rows.includes(r));
        return Promise.resolve({ data: del ? rows : rows.slice(0, limit), error: null }).then(ok, bad);
      },
    };
    return q;
  };
  const store = new SupabaseStore("https://x.supabase.co", "service-key");
  (store as unknown as { db: unknown }).db = { from };
  return { store, requests, tables };
}

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

describe("SupabaseStore paging", () => {
  it("reads past Supabase's 1000-row cap, each row once", async () => {
    const { store, requests } = fakeSupabase({ sessions: Array.from({ length: 2500 }, (_, n) => ({ id: id(n), plan_id: "p1" })) });
    const rows = await store.listSessions();
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500);
    expect(requests).toHaveLength(3);
  });

  it("asks for at most 100 plan ids per request and keeps the filters", async () => {
    const plans = Array.from({ length: 250 }, (_, n) => ({ id: id(n), clinic_id: n < 200 ? "c1" : "c2", closed_at: null }));
    const flags = plans.flatMap((p, n) => Array.from({ length: 6 }, (_, k) => ({ id: id(10_000 + n * 6 + k), plan_id: p.id })));
    const { store, requests } = fakeSupabase({ plans, flags });
    const mine = await store.listPlans({ clinicId: "c1" });
    expect(mine).toHaveLength(200);
    const got = await store.listFlags({ planIds: [...mine.map((p) => p.id), mine[0].id] });
    expect(got).toHaveLength(1200);
    expect(new Set(got.map((f) => f.id)).size).toBe(1200);
    const flagRequests = requests.filter((r) => r.table === "flags");
    expect(flagRequests.length).toBeGreaterThan(1);
    for (const r of flagRequests) expect(r.ids).toBeLessThanOrEqual(100);
    expect(await store.listSessions({ planIds: [] })).toEqual([]);
  });

  it("stops after a full last page and turns a database error into an exception", async () => {
    const { store, requests } = fakeSupabase({ plans: Array.from({ length: 1000 }, (_, n) => ({ id: id(n) })) });
    expect(await store.listPlans()).toHaveLength(1000);
    expect(requests).toHaveLength(2);
    await expect(allRows(async () => ({ data: null, error: { message: "boom" } }))).rejects.toThrow("database: boom");
  });

  it("purges and deletes by code in chunks", async () => {
    const plans: Row[] = Array.from({ length: 1200 }, (_, n) => ({ id: id(n), code: `P${n}`, closed_at: n < 1100 ? "2026-01-01T00:00:00Z" : null }));
    const { store, requests, tables } = fakeSupabase({ plans });
    expect(await store.purgeClosedBefore("2026-06-01T00:00:00Z")).toBe(1100);
    expect(tables.plans).toHaveLength(100);
    expect(await store.deletePlansByCode(["P1100", "P1101", "P5"])).toBe(2);
    expect(tables.plans).toHaveLength(98);
    for (const r of requests) expect(r.ids ?? 0).toBeLessThanOrEqual(100);
  });
});
