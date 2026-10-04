import { describe, expect, it } from "vitest";
import { getPosture, postures } from "@/lib/content";
import { angleDeg, medianFrame, point, projT } from "@/lib/pose/geometry";
import { calibrate, evaluate, requiredVisible, visibleSide } from "@/lib/pose/rules";
import { FIXTURES } from "./helpers/posture-fixtures";
import { frame, SITTING_FRONT, STANDING_FRONT } from "./helpers/skeleton";

describe("geometry", () => {
  it("measures angles in degrees", () => {
    expect(angleDeg({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
    expect(angleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
  });

  it("projects a point onto a segment", () => {
    expect(projT({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0.5);
  });

  it("returns null for invisible points and averages mid points", () => {
    const f = frame(STANDING_FRONT, 0, ["L_WRIST"]);
    expect(point(f, "L_WRIST")).toBeNull();
    expect(point(f, "MID_WRIST")).toBeNull();
    expect(point(f, "MID_HIP")).toEqual({ x: 500, y: 500 });
  });

  it("median filter removes a one-frame spike", () => {
    const frames = [0, 1, 2, 3, 4].map((i) => frame(STANDING_FRONT, i));
    frames[2].points[15].y = 0.05; // L_WRIST jumps
    expect(medianFrame(frames).points[15].y).toBeCloseTo(0.48);
  });
});

describe("calibration", () => {
  it("uses torso length as the unit", () => {
    expect(calibrate([frame(STANDING_FRONT)])!.U).toBeCloseTo(250);
  });
  it("fails when hips are not visible", () => {
    expect(calibrate([frame(STANDING_FRONT, 0, ["L_HIP", "R_HIP"])])).toBeNull();
  });
});

describe("posture rules on hand-made frames", () => {
  for (const p of postures) {
    const fx = FIXTURES[p.id];
    it(`${p.id}: in-pose frame passes, neutral frame fails`, () => {
      expect(fx, `missing fixture for ${p.id}`).toBeDefined();
      const calib = calibrate([frame(fx.neutral, 0, [], fx.dim)])!;
      const side = fx.side;
      expect(evaluate(p.detector.in_pose, { frame: frame(fx.inPose, 1, [], fx.dim), calib, side })).toBe(true);
      expect(evaluate(p.detector.in_pose, { frame: frame(fx.neutral, 1, [], fx.dim), calib, side })).toBe(false);
    });
  }

  it("kae-kiat checks the twist direction", () => {
    const fx = FIXTURES["kae-kiat"];
    const calib = calibrate([frame(fx.neutral)])!;
    const det = getPosture("kae-kiat").detector;
    expect(evaluate(det.in_pose, { frame: frame(fx.inPose), calib, side: "L" })).toBe(false);
  });

  it("kae-klon (reach to toes) is not mistaken for kae-khao-khat hands on thighs", () => {
    const fx = FIXTURES["kae-khao-khat"];
    const calib = calibrate([frame(fx.neutral, 0, [], fx.dim)])!;
    expect(evaluate(getPosture("kae-klon").detector.in_pose, { frame: frame(fx.inPose, 0, [], fx.dim), calib, side: null })).toBe(false);
  });

  it("hidden wrists make the posture false instead of throwing", () => {
    const fx = FIXTURES["kae-puat-thong-sabak-chom"];
    const calib = calibrate([frame(fx.neutral)])!;
    const det = getPosture("kae-puat-thong-sabak-chom").detector;
    expect(evaluate(det.in_pose, { frame: frame(fx.inPose, 0, ["L_WRIST"]), calib, side: null })).toBe(false);
  });

  it("picks the side the camera sees better", () => {
    const fx = FIXTURES["kae-khao-khat"];
    expect(visibleSide(frame(fx.inPose, 0, [], fx.dim))).toBe("L");
  });

  it("reports whether the required landmarks are in view", () => {
    const det = getPosture("damrong-kai-ayu-yuen").detector;
    expect(requiredVisible(det, frame(STANDING_FRONT), null)).toBe(true);
    expect(requiredVisible(det, frame(STANDING_FRONT, 0, ["L_ANKLE"]), null)).toBe(false);
    expect(requiredVisible(getPosture("kae-kiat").detector, frame(SITTING_FRONT), "R")).toBe(true);
  });
});
