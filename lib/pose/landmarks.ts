/** MediaPipe Pose landmark indexes (33-point model). */
export const LANDMARK_INDEX = {
  NOSE: 0,
  L_EAR: 7,
  R_EAR: 8,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
  L_HEEL: 29,
  R_HEEL: 30,
  L_FOOT: 31,
  R_FOOT: 32,
} as const;

export type LandmarkName = keyof typeof LANDMARK_INDEX;

/** Mid points are the average of the left and right landmark. */
export const MID_POINTS = ["MID_SHOULDER", "MID_HIP", "MID_WRIST", "MID_EAR", "MID_ANKLE", "MID_KNEE", "MID_ELBOW"] as const;
export type MidName = (typeof MID_POINTS)[number];

export type Side = "L" | "R";

export interface RawPoint {
  x: number; // 0..1 of video width
  y: number; // 0..1 of video height
  visibility: number; // 0..1
}

/** One camera frame worth of landmarks. */
export interface Frame {
  t: number; // ms
  width: number; // video px
  height: number; // video px
  points: RawPoint[]; // length 33
}

export const VISIBLE = 0.5;
