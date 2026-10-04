import type { Detector } from "@/lib/content/schema";
import type { Side } from "./landmarks";

export type Phase = "ready" | "hold" | "paused" | "release" | "done";

export interface SessionState {
  phase: Phase;
  unitsDone: number;
  unitsTarget: number;
  heldMs: number; // in the current unit
  totalHeldMs: number;
  side: Side | null; // side of the current unit
  lastT: number | null;
  lastInPoseT: number | null;
  releaseSinceT: number | null;
}

export const GRACE_MS = 700; // brief loss of the pose keeps the clock running
export const RELEASE_MS = 1000; // must leave the pose this long before the next unit
const MAX_DT = 200; // ignore gaps longer than this (tab paused, slow frame)

export function sideForUnit(det: Detector, unitIndex: number): Side | null {
  if (det.sides !== "alternate" || !det.first_side) return null;
  const first = det.first_side;
  return unitIndex % 2 === 0 ? first : first === "L" ? "R" : "L";
}

export function startSession(det: Detector): SessionState {
  return {
    phase: "ready",
    unitsDone: 0,
    unitsTarget: det.units,
    heldMs: 0,
    totalHeldMs: 0,
    side: sideForUnit(det, 0),
    lastT: null,
    lastInPoseT: null,
    releaseSinceT: null,
  };
}

/**
 * Advance the session with one frame result. Pure: returns a new state.
 * Hold mode and reps mode share this machine; reps simply use a short hold (detector.hold_seconds).
 */
export function step(det: Detector, s: SessionState, t: number, inPose: boolean): SessionState {
  if (s.phase === "done") return s;
  const dt = s.lastT === null ? 0 : Math.max(0, Math.min(MAX_DT, t - s.lastT));
  const next: SessionState = { ...s, lastT: t };
  if (inPose) next.lastInPoseT = t;
  const holdMs = det.hold_seconds * 1000;

  switch (s.phase) {
    case "ready":
      if (inPose) return { ...next, phase: "hold", heldMs: 0 };
      return next;
    case "paused":
      if (inPose) return { ...next, phase: "hold" };
      return next;
    case "hold": {
      const withinGrace = inPose || (s.lastInPoseT !== null && t - s.lastInPoseT <= GRACE_MS);
      if (!withinGrace) return { ...next, phase: "paused" };
      const heldMs = s.heldMs + dt;
      const totalHeldMs = s.totalHeldMs + dt;
      if (heldMs >= holdMs) {
        return { ...next, phase: "release", heldMs: holdMs, totalHeldMs, unitsDone: s.unitsDone + 1, releaseSinceT: inPose ? null : t };
      }
      return { ...next, heldMs, totalHeldMs };
    }
    case "release": {
      if (inPose) return { ...next, releaseSinceT: null };
      const since = s.releaseSinceT ?? t;
      if (t - since < RELEASE_MS) return { ...next, releaseSinceT: since };
      if (s.unitsDone >= s.unitsTarget) return { ...next, phase: "done", releaseSinceT: null };
      return { ...next, phase: "ready", heldMs: 0, releaseSinceT: null, side: sideForUnit(det, s.unitsDone) };
    }
  }
}

/** Result stored in the session record (sessions.results[]). */
export interface PostureResult {
  posture_id: string;
  method: "camera" | "button" | "skipped";
  units_done: number;
  units_target: number;
  seconds_held: number;
}

export function toResult(postureId: string, s: SessionState): PostureResult {
  return {
    posture_id: postureId,
    method: "camera",
    units_done: s.unitsDone,
    units_target: s.unitsTarget,
    seconds_held: Math.round(s.totalHeldMs / 100) / 10,
  };
}
