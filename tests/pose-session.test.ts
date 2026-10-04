import { describe, expect, it } from "vitest";
import { getPosture } from "@/lib/content";
import type { Detector } from "@/lib/content/schema";
import { startSession, step, toResult, type SessionState } from "@/lib/pose/session";

/** Feed frames every 100 ms from t0 for `ms`, with a constant inPose value. */
function run(det: Detector, s: SessionState, t0: number, ms: number, inPose: boolean): [SessionState, number] {
  let st = s;
  let t = t0;
  for (; t < t0 + ms; t += 100) st = step(det, st, t, inPose);
  return [st, t];
}

const hold = getPosture("damrong-kai-ayu-yuen").detector; // both sides, 10 s × 3
const alt = getPosture("kae-kiat").detector; // alternate R first, 10 s × 6 units
const reps = getPosture("kae-lom-pakang").detector; // reps: 3 s in pose, 6 units

describe("pose session (hold mode)", () => {
  it("waits in ready until the person is in the pose", () => {
    const [s] = run(hold, startSession(hold), 0, 3000, false);
    expect(s.phase).toBe("ready");
    expect(s.heldMs).toBe(0);
  });

  it("counts a unit after 10 s in the pose, then needs 1 s out of it", () => {
    let [s, t] = run(hold, startSession(hold), 0, 10200, true);
    expect(s.unitsDone).toBe(1);
    expect(s.phase).toBe("release");
    [s, t] = run(hold, s, t, 500, false);
    expect(s.phase).toBe("release");
    [s] = run(hold, s, t, 700, false);
    expect(s.phase).toBe("ready");
  });

  it("keeps counting through a short loss (≤ 0.7 s) of the pose", () => {
    let [s, t] = run(hold, startSession(hold), 0, 5000, true);
    [s, t] = run(hold, s, t, 500, false);
    expect(s.phase).toBe("hold");
    [s] = run(hold, s, t, 4600, true);
    expect(s.unitsDone).toBe(1);
  });

  it("pauses (without resetting) after a longer loss", () => {
    let [s, t] = run(hold, startSession(hold), 0, 5000, true);
    [s, t] = run(hold, s, t, 2000, false);
    expect(s.phase).toBe("paused");
    const held = s.heldMs;
    expect(held).toBeGreaterThan(4500);
    [s] = run(hold, s, t, 6000, true);
    expect(s.unitsDone).toBe(1);
  });

  it("finishes after all units", () => {
    let s = startSession(hold);
    let t = 0;
    for (let i = 0; i < 3; i++) {
      [s, t] = run(hold, s, t, 10300, true);
      [s, t] = run(hold, s, t, 1300, false);
    }
    expect(s.phase).toBe("done");
    expect(s.unitsDone).toBe(3);
    const r = toResult("damrong-kai-ayu-yuen", s);
    expect(r).toMatchObject({ method: "camera", units_done: 3, units_target: 3 });
    expect(r.seconds_held).toBeGreaterThanOrEqual(30);
  });

  it("ignores long gaps between frames (tab in background)", () => {
    let s = step(hold, startSession(hold), 0, true);
    s = step(hold, s, 100, true);
    s = step(hold, s, 60_000, true);
    expect(s.heldMs).toBeLessThanOrEqual(300);
  });
});

describe("alternate sides", () => {
  it("starts on the sheet's first side and switches each unit", () => {
    let s = startSession(alt);
    expect(s.side).toBe("R");
    let t = 0;
    [s, t] = run(alt, s, t, 10300, true);
    [s, t] = run(alt, s, t, 1300, false);
    expect(s.side).toBe("L");
    [s, t] = run(alt, s, t, 10300, true);
    [s] = run(alt, s, t, 1300, false);
    expect(s.side).toBe("R");
    expect(s.unitsDone).toBe(2);
  });
});

describe("reps mode", () => {
  it("counts a rep after 3 s in the pose and a release", () => {
    const [s1, t] = run(reps, startSession(reps), 0, 3200, true);
    expect(s1.unitsDone).toBe(1);
    const [s] = run(reps, s1, t, 1300, false);
    expect(s.phase).toBe("ready");
    expect(s.side).toBe("L");
  });
});
