import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPin } from "@/lib/auth";
import { setStore } from "@/lib/db";
import { MemoryStore } from "@/lib/db/memory";
import { addDays } from "@/lib/aggregate";
import { bangkokToday, resetRateLimits } from "@/lib/http";
import { POST as login } from "@/app/api/clinic/login/route";
import { POST as createPlan } from "@/app/api/plans/route";
import { PATCH as patchPlan } from "@/app/api/plans/[code]/route";
import { POST as reissue } from "@/app/api/plans/[code]/reissue/route";
import { GET as dashboard } from "@/app/api/clinic/dashboard/route";
import { PUT as putSettings } from "@/app/api/clinic/settings/route";
import { POST as ack } from "@/app/api/flags/[id]/ack/route";
import { POST as getPlan } from "@/app/api/p/[code]/plan/route";
import { POST as consent } from "@/app/api/p/[code]/consent/route";
import { POST as postSession } from "@/app/api/p/[code]/sessions/route";
import { POST as deleteMine } from "@/app/api/p/[code]/delete/route";
import { GET as calendar } from "@/app/api/p/[code]/calendar/route";
import { POST as dtamLogin } from "@/app/api/dtam/login/route";
import { GET as dtamSummaryRoute } from "@/app/api/dtam/summary/route";
import { POST as demoReset } from "@/app/api/demo/reset/route";

process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123";
process.env.DTAM_DEMO_PASSWORD = "dtam-demo";

const BASE = "http://localhost:3000";
const post = (path: string, body: unknown, cookie = "") =>
  new Request(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
const get = (path: string, cookie = "") => new Request(`${BASE}${path}`, { headers: { cookie } });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

let store: MemoryStore;
let clinicCookie: string;
const today = bangkokToday();

beforeEach(async () => {
  resetRateLimits();
  store = new MemoryStore();
  setStore(store);
  await store.insertClinic({ code: "CLINIC1", name: "คลินิกทดสอบ", pin_hash: hashPin("123456"), phone: "02-111-1111", is_demo: false, settings: { disabled: [], thresholds: {} } });
  await store.insertClinic({ code: "CLINIC2", name: "คลินิกอื่น", pin_hash: hashPin("654321"), phone: null, is_demo: false, settings: { disabled: [], thresholds: {} } });
  const res = await login(post("/api/clinic/login", { code: "clinic1", pin: "123456" }));
  clinicCookie = cookieOf(res);
});

async function newPlan(cookie = clinicCookie) {
  const res = await createPlan(post("/api/plans", {
    group_ids: ["knee"], posture_ids: ["kae-klon", "damrong-kai-ayu-yuen"], days_per_week: 7, remind_time: "19:00",
    start_date: today, next_visit_date: addDays(today, 14),
  }, cookie));
  return { res, body: (await res.json()) as { code: string; secret: string } };
}

const session = (over: Record<string, unknown> = {}) => ({
  client_id: "client-0001", performed_on: today, pain_before: 4, pain_after: 4,
  results: [{ posture_id: "kae-klon", method: "camera", units_done: 3, units_target: 3, seconds_held: 31 }],
  answers: {}, posture_flags: [], ...over,
});

describe("clinic auth", () => {
  it("logs in with code + pin and sets an httpOnly cookie", async () => {
    const res = await login(post("/api/clinic/login", { code: "CLINIC1", pin: "123456" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/hp_clinic=.+HttpOnly/);
  });
  it("rejects a wrong pin and locks after 5 failures", async () => {
    for (let i = 0; i < 5; i++) expect((await login(post("/api/clinic/login", { code: "CLINIC2", pin: "000000" }))).status).toBe(401);
    expect((await login(post("/api/clinic/login", { code: "CLINIC2", pin: "654321" }))).status).toBe(429);
  });
  it("requires login for clinic routes", async () => {
    expect((await dashboard(get("/api/clinic/dashboard"))).status).toBe(401);
    expect((await newPlan("")).res.status).toBe(401);
  });
});

describe("plans", () => {
  it("creates a plan and returns the secret once; only its hash is stored", async () => {
    const { res, body } = await newPlan();
    expect(res.status).toBe(201);
    expect(body.code).toMatch(/^[A-Z]{3}-\d{2}$/);
    const row = store.plans[0];
    expect(row.secret_hash).not.toContain(body.secret);
    expect(JSON.stringify(store.plans)).not.toContain(body.secret);
  });
  it("rejects postures outside the content and a visit before the start", async () => {
    const bad = await createPlan(post("/api/plans", { group_ids: ["knee"], posture_ids: ["made-up"], days_per_week: 7, remind_time: "19:00", start_date: today, next_visit_date: addDays(today, 7) }, clinicCookie));
    expect(bad.status).toBe(400);
    const bad2 = await createPlan(post("/api/plans", { group_ids: ["knee"], posture_ids: ["kae-klon"], days_per_week: 7, remind_time: "19:00", start_date: today, next_visit_date: today }, clinicCookie));
    expect(bad2.status).toBe(400);
  });
  it("another clinic cannot touch the plan", async () => {
    const { body } = await newPlan();
    const other = cookieOf(await login(post("/api/clinic/login", { code: "CLINIC2", pin: "654321" })));
    const res = await patchPlan(new Request(`${BASE}/api/plans/${body.code}`, { method: "PATCH", headers: { cookie: other }, body: JSON.stringify({ status: "stopped" }) }), params({ code: body.code }));
    expect(res.status).toBe(404);
  });
  it("reissuing a slip invalidates the old secret", async () => {
    const { body } = await newPlan();
    const re = await (await reissue(post(`/api/plans/${body.code}/reissue`, {}, clinicCookie), params({ code: body.code }))).json();
    expect((await getPlan(post(`/api/p/${body.code}/plan`, { secret: body.secret }), params({ code: body.code }))).status).toBe(401);
    expect((await getPlan(post(`/api/p/${body.code}/plan`, { secret: re.secret }), params({ code: body.code }))).status).toBe(200);
  });
});

describe("patient flow", () => {
  it("needs the right secret (same answer for wrong code and wrong secret)", async () => {
    const { body } = await newPlan();
    const wrong = await getPlan(post(`/api/p/${body.code}/plan`, { secret: "A".repeat(22) }), params({ code: body.code }));
    const nocode = await getPlan(post(`/api/p/ZZZ-99/plan`, { secret: body.secret }), params({ code: "ZZZ-99" }));
    expect(wrong.status).toBe(401);
    expect(nocode.status).toBe(401);
    expect(await wrong.json()).toEqual(await nocode.json());
  });

  it("requires consent before sessions, then stores the session", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    expect((await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session() }), p)).status).toBe(403);
    expect((await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p)).status).toBe(200);
    const res = await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session() }), p);
    expect(res.status).toBe(201);
    expect(store.sessions).toHaveLength(1);
  });

  it("returns the days with a posture done (not all-skipped sessions) for the week strip", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    const yesterday = addDays(today, -1);
    await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ performed_on: yesterday }) }), p);
    const skipped = [{ posture_id: "kae-klon", method: "skipped", units_done: 0, units_target: 3, seconds_held: 0 }];
    await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ client_id: "client-0002", results: skipped }) }), p);
    const plan = (await (await getPlan(post(`/api/p/${body.code}/plan`, { secret: body.secret }), p)).json()) as { done_days: string[] };
    expect(plan.done_days).toEqual([yesterday]);
  });

  it("is idempotent on client_id (offline retries)", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ answers: { RF04: true } }) }), p);
    const again = await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ answers: { RF04: true } }) }), p);
    expect(again.status).toBe(200);
    expect((await again.json()).duplicate).toBe(true);
    expect(store.sessions).toHaveLength(1);
    expect(store.flags).toHaveLength(1);
  });

  it("keeps the red flags when the first attempt failed after the session row was saved", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    const orig = store.insertFlags.bind(store);
    let calls = 0;
    store.insertFlags = async (f) => {
      if (calls++ === 0) throw new Error("db down");
      return orig(f);
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mk = () => post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ answers: { RF04: true } }) });
    expect((await postSession(mk(), p)).status).toBe(500);
    expect(store.sessions).toHaveLength(1);
    expect(store.flags).toHaveLength(0);
    const retry = await postSession(mk(), p);
    expect(retry.status).toBe(200);
    expect(store.sessions).toHaveLength(1);
    expect(store.flags).toHaveLength(1);
    expect(store.flags[0].session_id).toBe(store.sessions[0].id);
    await postSession(mk(), p);
    expect(store.flags).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("re-evaluates red flags on the server and attaches the posture", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    const res = await postSession(post(`/api/p/${body.code}/sessions`, {
      secret: body.secret,
      session: session({ answers: { RF04: true }, posture_flags: [{ rule_id: "RF04", posture_id: "kae-klon" }] }),
    }), p);
    const out = await res.json();
    expect(out.worst).toMatchObject({ rule_id: "RF04", level: "stop_and_contact_clinic", posture_id: "kae-klon" });
    expect(store.flags[0]).toMatchObject({ rule_id: "RF04", posture_id: "kae-klon" });
  });

  it("rejects results for postures that are not in the plan", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    const res = await postSession(post(`/api/p/${body.code}/sessions`, {
      secret: body.secret, session: session({ results: [{ posture_id: "kae-kiat", method: "button", units_done: 6, units_target: 6, seconds_held: 0 }] }),
    }), p);
    expect(res.status).toBe(400);
  });

  it("serves a calendar file only with the secret", async () => {
    const { body } = await newPlan();
    const ok = await calendar(get(`/api/p/${body.code}/calendar?k=${body.secret}`), params({ code: body.code }));
    expect(ok.headers.get("content-type")).toContain("text/calendar");
    expect(await ok.text()).toContain("RRULE:FREQ=DAILY");
    expect((await calendar(get(`/api/p/${body.code}/calendar?k=bad`), params({ code: body.code }))).status).toBe(401);
  });

  it("'ลบข้อมูลของฉัน' deletes sessions and flags and stops the plan", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ answers: { RF04: true } }) }), p);
    expect((await deleteMine(post(`/api/p/${body.code}/delete`, { secret: body.secret }), p)).status).toBe(200);
    expect(store.sessions).toHaveLength(0);
    expect(store.flags).toHaveLength(0);
    expect(store.plans[0].status).toBe("stopped");
    expect(store.plans[0].consent_at).toBeNull();
  });

  it("'ลบข้อมูลของฉัน' on a completed plan deletes the data but keeps it completed", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ answers: { RF04: true } }) }), p);
    await store.updatePlan(store.plans[0].id, { status: "completed", closed_at: "2026-10-01T09:00:00Z" });
    expect((await deleteMine(post(`/api/p/${body.code}/delete`, { secret: body.secret }), p)).status).toBe(200);
    expect(store.sessions).toHaveLength(0);
    expect(store.flags).toHaveLength(0);
    expect(store.plans[0].status).toBe("completed");
    expect(store.plans[0].consent_at).toBeNull();
    expect(store.plans[0].closed_at).toBe("2026-10-01T09:00:00Z");
  });
});

describe("clinic dashboard and settings", () => {
  it("shows the flag and lets the clinic acknowledge it", async () => {
    const { body } = await newPlan();
    const p = params({ code: body.code });
    await consent(post(`/api/p/${body.code}/consent`, { secret: body.secret }), p);
    await postSession(post(`/api/p/${body.code}/sessions`, { secret: body.secret, session: session({ answers: { RF04: true } }) }), p);
    const dash = await (await dashboard(get("/api/clinic/dashboard", clinicCookie))).json();
    expect(dash.items[0].open_flags[0].rule_id).toBe("RF04");
    expect(dash.items[0].priority).toBe(0);
    const id = dash.items[0].open_flags[0].id;
    expect((await ack(post(`/api/flags/${id}/ack`, {}, clinicCookie), params({ id }))).status).toBe(200);
    const after = await (await dashboard(get("/api/clinic/dashboard", clinicCookie))).json();
    expect(after.items[0].open_flags).toEqual([]);
  });

  it("refuses to disable emergency rules", async () => {
    const put = (b: unknown) => putSettings(new Request(`${BASE}/api/clinic/settings`, { method: "PUT", headers: { cookie: clinicCookie }, body: JSON.stringify(b) }));
    expect((await put({ disabled: ["RF01"], thresholds: {} })).status).toBe(400);
    expect((await put({ disabled: ["RF09"], thresholds: { RF08: 4 } })).status).toBe(200);
  });
});

describe("DTAM and demo", () => {
  it("DTAM summary needs the demo password", async () => {
    expect((await dtamSummaryRoute(get("/api/dtam/summary"))).status).toBe(401);
    expect((await dtamLogin(post("/api/dtam/login", { password: "nope" }))).status).toBe(401);
    const c = cookieOf(await dtamLogin(post("/api/dtam/login", { password: "dtam-demo" })));
    const res = await dtamSummaryRoute(get("/api/dtam/summary", c));
    expect(res.status).toBe(200);
    expect((await res.json()).clinics).toHaveLength(2);
  });

  it("demo reset is off without a token and reseeds with one", async () => {
    delete process.env.DEMO_RESET_TOKEN;
    expect((await demoReset(post("/api/demo/reset", { token: "whatever-token" }))).status).toBe(404);
    process.env.DEMO_RESET_TOKEN = "reset-token-123";
    const res = await demoReset(post("/api/demo/reset", { token: "reset-token-123" }));
    expect(res.status).toBe(200);
    expect(store.clinics.map((c) => c.code)).toEqual(["DEMO-A", "DEMO-B", "DEMO-C"]);
  });
});

describe("error envelope", () => {
  it("turns an unexpected exception into a JSON 500 without details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    store.listPlans = async () => {
      throw new Error("boom secret detail");
    };
    const res = await dashboard(get("/api/clinic/dashboard", clinicCookie));
    expect(res.status).toBe(500);
    const b = await res.json();
    expect(b.error).toBe("server_error");
    expect(typeof b.message_th).toBe("string");
    expect(JSON.stringify(b)).not.toContain("boom");
    vi.restoreAllMocks();
  });

  it("answers 404 for a flag id that is not a UUID, before touching the store", async () => {
    let touched = false;
    store.acknowledgeFlag = async () => {
      touched = true;
      return false;
    };
    const res = await ack(post("/api/flags/not-a-uuid/ack", {}, clinicCookie), params({ id: "not-a-uuid" }));
    expect(res.status).toBe(404);
    expect(touched).toBe(false);
  });
});

describe("privacy", () => {
  it("stores no field that could hold a name, phone of a patient or HN", () => {
    const planKeys = ["id", "code", "secret_hash", "clinic_id", "group_ids", "posture_ids", "days_per_week", "remind_time", "start_date", "next_visit_date", "status", "consent_at", "closed_at", "created_at"];
    for (const k of planKeys) expect(k).not.toMatch(/name|phone|hn|citizen|id_card/i);
  });
});
