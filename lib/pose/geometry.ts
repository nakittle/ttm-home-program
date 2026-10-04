import { LANDMARK_INDEX, MID_POINTS, VISIBLE, type Frame, type LandmarkName, type MidName } from "./landmarks";

export interface Pt {
  x: number; // px
  y: number; // px, grows downward
}

/** Pixel position of a named or mid point, or null when not visible enough. */
export function point(frame: Frame, name: string): Pt | null {
  if ((MID_POINTS as readonly string[]).includes(name)) {
    const base = (name as MidName).slice(4); // e.g. "HIP"
    const a = point(frame, `L_${base}`);
    const b = point(frame, `R_${base}`);
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  const idx = LANDMARK_INDEX[name as LandmarkName];
  if (idx === undefined) throw new Error(`unknown point ${name}`);
  const p = frame.points[idx];
  if (!p || p.visibility < VISIBLE) return null;
  return { x: p.x * frame.width, y: p.y * frame.height };
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Angle ABC in degrees (0..180). */
export function angleDeg(a: Pt, b: Pt, c: Pt): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const den = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (den === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / den));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Position of p along a→b: 0 at a, 1 at b. */
export function projT(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

/** Torso length (mid shoulder to mid hip) in px: the unit "U" every rule threshold uses. */
export function torsoLength(frame: Frame): number | null {
  const s = point(frame, "MID_SHOULDER");
  const h = point(frame, "MID_HIP");
  if (!s || !h) return null;
  const u = dist(s, h);
  return u > 0 ? u : null;
}

/** Median-filter the last frames landmark by landmark (removes single-frame jitter). */
export function medianFrame(frames: Frame[]): Frame {
  const last = frames[frames.length - 1];
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const points = last.points.map((_, i) => ({
    x: med(frames.map((f) => f.points[i].x)),
    y: med(frames.map((f) => f.points[i].y)),
    visibility: med(frames.map((f) => f.points[i].visibility)),
  }));
  return { ...last, points };
}
