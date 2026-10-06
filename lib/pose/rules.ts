import type { Condition, Detector } from "@/lib/content/schema";
import { angleDeg, dist, medianFrame, point, projT, torsoLength, type Pt } from "./geometry";
import { LANDMARK_INDEX, type Frame, type Side } from "./landmarks";

/** Measured in the neutral starting position; every threshold is a multiple of U. */
export interface Calibration {
  U: number; // torso length px
  base: Frame; // median neutral frame
}

export interface RuleContext {
  frame: Frame;
  calib: Calibration;
  side: Side | null; // active side for "alternate" postures
}

const other = (s: Side): Side => (s === "L" ? "R" : "L");

/** Side whose arm/leg landmarks the camera sees better (for side-view postures). */
export function visibleSide(frame: Frame): Side {
  const parts = ["SHOULDER", "ELBOW", "WRIST", "HIP", "KNEE", "ANKLE"] as const;
  const score = (s: Side) =>
    parts.reduce((sum, p) => sum + frame.points[LANDMARK_INDEX[`${s}_${p}` as keyof typeof LANDMARK_INDEX]].visibility, 0);
  return score("L") >= score("R") ? "L" : "R";
}

export function resolveName(name: string, ctx: RuleContext): string {
  if (name.includes("{V}")) return name.replace("{V}", visibleSide(ctx.frame));
  if (name.includes("{S}") || name.includes("{O}")) {
    if (!ctx.side) throw new Error(`${name} needs an active side`);
    return name.replace("{S}", ctx.side).replace("{O}", other(ctx.side));
  }
  return name;
}

function pts(names: string[], ctx: RuleContext): Pt[] | null {
  const out: Pt[] = [];
  for (const n of names) {
    const p = point(ctx.frame, resolveName(n, ctx));
    if (!p) return null;
    out.push(p);
  }
  return out;
}

/** Is the person in the posture described by `cond` in this frame? Invisible points make it false. */
export function evaluate(cond: Condition, ctx: RuleContext): boolean {
  const U = ctx.calib.U;
  if ("all" in cond) return cond.all.every((c) => evaluate(c, ctx));
  if ("any" in cond) return cond.any.some((c) => evaluate(c, ctx));
  if ("not" in cond) return !evaluate(cond.not, ctx);
  if ("angle" in cond) {
    const p = pts(cond.angle, ctx);
    if (!p) return false;
    const a = angleDeg(p[0], p[1], p[2]);
    return (cond.gte === undefined || a >= cond.gte) && (cond.lte === undefined || a <= cond.lte);
  }
  if ("above" in cond) {
    const p = pts(cond.above, ctx);
    return !!p && (p[1].y - p[0].y) / U >= cond.by;
  }
  if ("below" in cond) {
    const p = pts(cond.below, ctx);
    return !!p && (p[0].y - p[1].y) / U >= cond.by;
  }
  if ("near" in cond) {
    const p = pts(cond.near, ctx);
    return !!p && dist(p[0], p[1]) / U <= cond.within;
  }
  if ("level" in cond) {
    const p = pts(cond.level, ctx);
    return !!p && Math.abs(p[0].y - p[1].y) / U <= cond.within;
  }
  if ("xdist" in cond) {
    const p = pts(cond.xdist, ctx);
    if (!p) return false;
    const d = Math.abs(p[0].x - p[1].x) / U;
    return (cond.gte === undefined || d >= cond.gte) && (cond.lte === undefined || d <= cond.lte);
  }
  if ("toward" in cond) {
    const sideName = resolveName(cond.toward[1], ctx) as Side;
    const p = pts([cond.toward[0], `${sideName}_SHOULDER`, `${other(sideName)}_SHOULDER`, "MID_SHOULDER"], ctx);
    if (!p) return false;
    const sign = Math.sign(p[1].x - p[2].x) || 1;
    return ((p[0].x - p[3].x) * sign) / U >= cond.by;
  }
  if ("drop" in cond) {
    const name = resolveName(cond.drop[0], ctx);
    const now = point(ctx.frame, name);
    const then = point(ctx.calib.base, name);
    return !!now && !!then && (now.y - then.y) / U >= cond.by;
  }
  if ("between" in cond) {
    const p = pts(cond.between, ctx);
    if (!p) return false;
    const margin = 0.05 * U;
    const top = Math.min(p[1].y, p[2].y) - margin;
    const bottom = Math.max(p[1].y, p[2].y) + margin;
    return p[0].y >= top && p[0].y <= bottom;
  }
  if ("proj" in cond) {
    const p = pts(cond.proj, ctx);
    if (!p) return false;
    const t = projT(p[0], p[1], p[2]);
    return t >= cond.min && t <= cond.max;
  }
  throw new Error(`unknown condition ${JSON.stringify(cond)}`);
}

/** Are all landmarks this posture needs visible (for the camera-setup screen)? Includes the torso, which calibration needs. */
export function requiredVisible(det: Detector, frame: Frame, side: Side | null): boolean {
  const ctx: RuleContext = { frame, calib: { U: 1, base: frame }, side: side ?? "L" };
  return torsoLength(frame) !== null && det.required.every((n) => point(frame, resolveName(n, ctx)) !== null);
}

/** Calibrate from ~2 s of neutral frames. Returns null when the torso is not visible. */
export function calibrate(frames: Frame[]): Calibration | null {
  if (frames.length === 0) return null;
  const base = medianFrame(frames);
  const U = torsoLength(base);
  return U ? { U, base } : null;
}
