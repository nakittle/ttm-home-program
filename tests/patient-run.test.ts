import { describe, expect, it } from "vitest";
import type { PostureResult } from "@/lib/pose/session";
import {
  advance,
  applyRaise,
  classifySubmit,
  emptyRun,
  isRetryableStatus,
  reportedSymptom,
  sessionBody,
  skippedResult,
  stopRun,
  stopsNow,
  visibleFlags,
} from "@/lib/patient-run";
import { rulesAskedAt } from "@/lib/content";
import { DEFAULT_SETTINGS, evaluateRedFlags, stopsSession, type FiredFlag } from "@/lib/redflags";

// sitting, standing, sitting, standing, standing, sitting
const PLAN = ["kae-kiat", "kae-salak-lai", "kae-khao-khat", "kae-kho-khlet-kae-lai-khat", "kae-khao-kae-kha", "kae-klon"];
const done = (id: string): PostureResult => ({ posture_id: id, method: "button", units_done: 3, units_target: 3, seconds_held: 30 });

describe("patient run: stopping", () => {
  it("a stop at the pre-check sends every planned posture as skipped", () => {
    const run = { ...emptyRun(), answers: { RF02: true } };
    expect(stopsNow(run, DEFAULT_SETTINGS)).toBe(true);
    const out = stopRun(run, PLAN);
    expect(out.results.map((r) => r.posture_id)).toEqual(PLAN);
    expect(out.results.every((r) => r.method === "skipped" && r.units_done === 0)).toBe(true);
  });

  it("a stop at pain-before (RF07) also skips everything", () => {
    const run = { ...emptyRun(), painBefore: 8 };
    expect(stopsNow(run, DEFAULT_SETTINGS)).toBe(true);
    expect(stopRun(run, PLAN).results).toHaveLength(PLAN.length);
  });

  // The questions end at the first stop-level "yes", so the later answers are missing: the run still stops and sends that flag.
  for (const r of [...rulesAskedAt("pre"), ...rulesAskedAt("post")].filter((x) => stopsSession(x.level))) {
    it(`a "yes" to ${r.id} alone (questions ended early) stops the run and sends ${r.id}`, () => {
      const run = { ...emptyRun(), answers: { [r.id]: true } };
      expect(stopsNow(run, DEFAULT_SETTINGS)).toBe(true);
      const body = sessionBody(stopRun(run, PLAN), "client-123456", "2026-10-07");
      expect(body.answers).toEqual({ [r.id]: true });
      expect(evaluateRedFlags({ answers: body.answers }).map((f) => f.rule_id)).toContain(r.id);
    });
  }

  it("a stop mid-session keeps finished postures and skips the rest", () => {
    const run = { ...emptyRun(), results: [done(PLAN[0])] };
    const out = applyRaise(run, "RF04", 1, PLAN, DEFAULT_SETTINGS);
    expect(out.kind).toBe("stop");
    expect(out.run.results.map((r) => [r.posture_id, r.method])).toEqual([
      [PLAN[0], "button"],
      ...PLAN.slice(1).map((id) => [id, "skipped"]),
    ]);
  });
});

describe("patient run: flag attribution (no stale state)", () => {
  it("the posture flag raised just now is in the answers and posture_flags sent with the session", () => {
    const out = applyRaise(emptyRun(), "RF04", 2, PLAN, DEFAULT_SETTINGS);
    const body = sessionBody(out.run, "client-123456", "2026-10-04");
    expect(body.answers).toEqual({ RF04: true });
    expect(body.posture_flags).toEqual([{ rule_id: "RF04", posture_id: PLAN[2] }]);
    expect(body.client_id).toBe("client-123456");
  });

  it("earlier pause flags are kept when a later stop flag fires", () => {
    const a = applyRaise(emptyRun(), "RF10", 0, PLAN, DEFAULT_SETTINGS);
    expect(a.kind).toBe("pause");
    const b = applyRaise(advance(a.run, PLAN, 0, skippedResult(PLAN[0])).run, "RF01", 1, PLAN, DEFAULT_SETTINGS);
    expect(b.kind).toBe("stop");
    expect(b.run.postureFlags).toEqual([
      { rule_id: "RF10", posture_id: PLAN[0] },
      { rule_id: "RF01", posture_id: PLAN[1] },
    ]);
    expect(b.run.answers).toEqual({ RF10: true, RF01: true });
  });
});

describe("patient run: pause-level flags", () => {
  for (const id of ["RF10", "RF11", "RF12"]) {
    it(`${id} pauses the posture instead of stopping`, () => {
      const out = applyRaise(emptyRun(), id, 1, PLAN, DEFAULT_SETTINGS);
      expect(out).toMatchObject({ kind: "pause", ruleId: id });
    });
  }

  it("after RF11 every remaining standing posture is skipped, sitting ones are still presented", () => {
    const p = applyRaise({ ...emptyRun(), results: [done(PLAN[0])] }, "RF11", 1, PLAN, DEFAULT_SETTINGS);
    expect(p.run.skipStanding).toBe(true);
    const a = advance(p.run, PLAN, 1, skippedResult(PLAN[1]));
    expect(a.next).toBe(2); // sitting
    const b = advance(a.run, PLAN, 2, done(PLAN[2]));
    expect(b.next).toBe(5); // two standing postures skipped
    expect(b.run.results.map((r) => [r.posture_id, r.method])).toEqual([
      [PLAN[0], "button"],
      [PLAN[1], "skipped"],
      [PLAN[2], "button"],
      [PLAN[3], "skipped"],
      [PLAN[4], "skipped"],
    ]);
    const c = advance(b.run, PLAN, 5, done(PLAN[5]));
    expect(c.next).toBeNull();
    expect(c.run.results.map((r) => r.posture_id)).toEqual(PLAN);
  });

  it("RF11 on the last sitting posture before standing ones ends the postures", () => {
    const plan = ["kae-kiat", "kae-salak-lai", "damrong-kai-ayu-yuen"];
    const p = applyRaise(emptyRun(), "RF11", 0, plan, DEFAULT_SETTINGS);
    const a = advance(p.run, plan, 0, skippedResult(plan[0]));
    expect(a.next).toBeNull();
    expect(a.run.results.map((r) => r.method)).toEqual(["skipped", "skipped", "skipped"]);
  });

  it("without RF11 standing postures are presented normally", () => {
    expect(advance(emptyRun(), PLAN, 0, done(PLAN[0])).next).toBe(1);
  });
});

describe("patient run: leaving early", () => {
  it("nothing reported: leaving sends nothing", () => {
    expect(reportedSymptom(emptyRun())).toBe(false);
    expect(reportedSymptom({ ...emptyRun(), answers: { RF01: false, RF12: false }, painBefore: 3 })).toBe(false);
  });

  it("a button during a posture or a 'yes' answer is reported, so leaving sends it", () => {
    const paused = applyRaise(emptyRun(), "RF11", 1, PLAN, DEFAULT_SETTINGS);
    expect(paused.kind).toBe("pause");
    expect(reportedSymptom(paused.run)).toBe(true);
    expect(reportedSymptom({ ...emptyRun(), answers: { RF12: true } })).toBe(true);
    const body = sessionBody(stopRun(paused.run, PLAN), "client-123456", "2026-10-07");
    expect(body.posture_flags).toEqual([{ rule_id: "RF11", posture_id: PLAN[1] }]);
    expect(body.results).toHaveLength(PLAN.length);
  });
});

describe("patient run: result screen and submit", () => {
  const flags = (answers: Record<string, boolean>, painBefore = 2, painAfter = 2): FiredFlag[] =>
    evaluateRedFlags({ answers, painBefore, painAfter });

  it("after a 1669 flag only 1669 cards are shown (no pause or note cards)", () => {
    const shown = visibleFlags(flags({ RF01: true, RF10: true, RF04: true }));
    expect(shown.map((f) => f.level)).toEqual(["call_1669"]);
  });

  it("after a stop_and_contact_clinic flag pause cards are hidden", () => {
    const shown = visibleFlags(flags({ RF04: true, RF11: true }));
    expect(shown.map((f) => f.rule_id)).toEqual(["RF04"]);
  });

  it("pause and note flags are all shown when nothing stops the run", () => {
    expect(visibleFlags(flags({ RF10: true, RF11: true })).map((f) => f.rule_id).sort()).toEqual(["RF10", "RF11"]);
    expect(visibleFlags([])).toEqual([]);
  });

  it("queues on offline, 429 and 5xx; rejects 400/401/403/410", () => {
    expect(classifySubmit(true, 200)).toBe("sent");
    for (const s of [0, 429, 500, 502, 503]) expect(classifySubmit(false, s)).toBe("retry");
    for (const s of [400, 401, 403, 404, 410]) expect(classifySubmit(false, s)).toBe("rejected");
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(403)).toBe(false);
  });
});
