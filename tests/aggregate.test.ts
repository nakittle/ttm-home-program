import { beforeAll, describe, expect, it } from "vitest";
import { addDays, adherence, clinicDashboard, daysBetween, dtamSummary, MIN_CELL } from "@/lib/aggregate";
import { hashPin, verifyPin } from "@/lib/auth";
import { MemoryStore } from "@/lib/db/memory";
import type { PlanRow, SessionRow } from "@/lib/db/types";
import { getPosture } from "@/lib/content";
import { seedDemo } from "@/lib/seed";

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: "p1", code: "ABC-23", secret_hash: "x", clinic_id: "c1", group_ids: ["knee"], posture_ids: ["kae-klon"],
  days_per_week: 7, remind_time: "19:00", start_date: "2026-10-01", next_visit_date: "2026-10-14",
  status: "active", consent_at: null, closed_at: null, created_at: "2026-10-01T00:00:00Z", ...over,
});
const session = (on: string, method: "camera" | "button" | "skipped" = "camera", over: Partial<SessionRow> = {}): SessionRow => ({
  id: on, plan_id: "p1", performed_on: on, pain_before: 4, pain_after: 3,
  results: [{ posture_id: "kae-klon", method, units_done: method === "skipped" ? 0 : 3, units_target: 3, seconds_held: 30 }],
  answers: {}, client_id: on, created_at: `${on}T12:00:00Z`, ...over,
});

describe("dates", () => {
  it("adds and diffs days", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
  });
});

describe("adherence", () => {
  it("is done days / expected days, capped at 1", () => {
    const p = plan();
    const ss = ["2026-10-01", "2026-10-02", "2026-10-03"].map((d) => session(d));
    expect(adherence(p, ss, "2026-10-01", "2026-10-04")).toBeCloseTo(0.75);
    expect(adherence(p, [...ss, session("2026-10-04"), session("2026-10-04", "camera", { id: "dup", client_id: "dup" })], "2026-10-01", "2026-10-04")).toBe(1);
  });
  it("scales the expectation by days per week", () => {
    expect(adherence(plan({ days_per_week: 3 }), [session("2026-10-01"), session("2026-10-03"), session("2026-10-05")], "2026-10-01", "2026-10-07")).toBe(1);
  });
  it("ignores sessions where every posture was skipped", () => {
    expect(adherence(plan(), [session("2026-10-01", "skipped")], "2026-10-01", "2026-10-02")).toBe(0);
  });
  it("is null before the plan starts", () => {
    expect(adherence(plan(), [], "2026-09-01", "2026-09-10")).toBeNull();
  });
});

describe("clinic dashboard", () => {
  it("puts unacknowledged red flags first, then inactive patients", () => {
    const p1 = plan({ id: "p1", code: "AAA-22" });
    const p2 = plan({ id: "p2", code: "BBB-22" });
    const p3 = plan({ id: "p3", code: "CCC-22", next_visit_date: "2026-10-25" });
    const sessions = [session("2026-10-05"), { ...session("2026-10-06"), plan_id: "p3", id: "s3", client_id: "s3" }];
    const flags = [{ id: "f1", plan_id: "p2", session_id: null, rule_id: "RF04", level: "stop_and_contact_clinic" as const, posture_id: "kae-klon", created_at: "2026-10-06T00:00:00Z", acknowledged_at: null }];
    const items = clinicDashboard([p1, p2, p3], sessions, flags, "2026-10-08");
    expect(items.map((i) => i.code)).toEqual(["BBB-22", "AAA-22", "CCC-22"]);
    expect(items[0].priority).toBe(0);
    expect(items[1].priority_reason).toBe("ไม่ได้ทำ 3 วัน");
  });
  it("treats acknowledged flags and notes as non-urgent", () => {
    const flags = [
      { id: "f1", plan_id: "p1", session_id: null, rule_id: "RF04", level: "stop_and_contact_clinic" as const, posture_id: null, created_at: "x", acknowledged_at: "y" },
      { id: "f2", plan_id: "p1", session_id: null, rule_id: "RF09", level: "note_for_next_visit" as const, posture_id: null, created_at: "x", acknowledged_at: null },
    ];
    const [item] = clinicDashboard([plan()], [session("2026-10-07")], flags, "2026-10-08");
    expect(item.open_flags).toEqual([]);
    expect(item.notes).toHaveLength(1);
    expect(item.priority).toBe(4);
  });
  it("reports how many postures were counted by camera", () => {
    const [item] = clinicDashboard([plan()], [session("2026-10-01"), session("2026-10-02", "button")], [], "2026-10-03");
    expect(item.camera_share).toBe(0.5);
  });
});

describe("pin hashing", () => {
  it("verifies the right pin only", () => {
    const h = hashPin("246810");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verifyPin("246810", h)).toBe(true);
    expect(verifyPin("000000", h)).toBe(false);
    expect(verifyPin("246810", "garbage")).toBe(false);
  });
  it("rejects malformed stored hashes instead of comparing empty buffers", () => {
    expect(verifyPin("123456", "scrypt$aa$zz")).toBe(false);
    expect(verifyPin("123456", "scrypt$aa$")).toBe(false);
    expect(verifyPin("123456", "scrypt$zz$" + "ab".repeat(32))).toBe(false);
    expect(verifyPin("123456", "scrypt$aa$" + "ab".repeat(16))).toBe(false);
  });
});

describe("demo seed + DTAM summary", () => {
  const store = new MemoryStore();
  const today = "2026-10-08";
  let counts: Awaited<ReturnType<typeof seedDemo>>;
  beforeAll(async () => {
    counts = await seedDemo(store, today, "246810");
  });

  it("creates 3 demo clinics and 60 plans, deterministically", async () => {
    expect(counts.clinics).toBe(3);
    expect(counts.plans).toBe(60);
    expect(counts.sessions).toBeGreaterThan(200);
    const again = new MemoryStore();
    expect(await seedDemo(again, today, "246810")).toEqual(counts);
  });

  it("only puts RF11 (unsteady) on standing postures of the plan", () => {
    const rf11 = store.flags.filter((f) => f.rule_id === "RF11");
    expect(rf11.length).toBeGreaterThan(0);
    for (const f of rf11) {
      const plan = store.plans.find((p) => p.id === f.plan_id)!;
      expect(f.posture_id).not.toBeNull();
      expect(plan.posture_ids).toContain(f.posture_id);
      expect(getPosture(f.posture_id!).position).toBe("standing");
    }
  });

  it("summarises without any per-patient rows", () => {
    const s = dtamSummary(store.clinics, store.plans, store.sessions, store.flags, today);
    expect(s.totals.plans).toBe(60);
    expect(s.weekly_adherence).toHaveLength(8);
    expect(s.clinics).toHaveLength(3);
    expect(JSON.stringify(s)).not.toMatch(/[A-Z]{3}-\d{2}/); // no plan codes leak
    expect(s.totals.adherence).toBeGreaterThan(0);
    expect(s.totals.adherence).toBeLessThanOrEqual(1);
  });

  it(`hides clinics with fewer than ${MIN_CELL} plans`, async () => {
    const one = store.plans.filter((p) => p.clinic_id === store.clinics[0].id).slice(0, 3);
    const s = dtamSummary(store.clinics.slice(0, 1), one, store.sessions, [], today);
    expect(s.clinics[0].hidden).toBe(true);
    expect(s.clinics[0].plans).toBeNull();
  });
});
