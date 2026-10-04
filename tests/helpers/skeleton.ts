import { LANDMARK_INDEX, type Frame, type LandmarkName } from "@/lib/pose/landmarks";

export type Pose = Partial<Record<LandmarkName, [number, number]>>;

/** Build a 1000×1000 px frame; listed points visible (0.99), others invisible. */
export function frame(pose: Pose, t = 0, hidden: LandmarkName[] = [], dim: LandmarkName[] = []): Frame {
  const points = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  for (const [name, xy] of Object.entries(pose) as [LandmarkName, [number, number]][]) {
    const vis = hidden.includes(name) ? 0.1 : dim.includes(name) ? 0.6 : 0.99;
    points[LANDMARK_INDEX[name]] = { x: xy[0] / 1000, y: xy[1] / 1000, visibility: vis };
  }
  return { t, width: 1000, height: 1000, points };
}

// Person facing the camera. Person's LEFT appears on the image RIGHT (larger x). Torso length U = 250 px.
export const STANDING_FRONT: Pose = {
  NOSE: [500, 150], L_EAR: [530, 140], R_EAR: [470, 140],
  L_SHOULDER: [580, 250], R_SHOULDER: [420, 250],
  L_ELBOW: [600, 370], R_ELBOW: [400, 370],
  L_WRIST: [605, 480], R_WRIST: [395, 480],
  L_HIP: [560, 500], R_HIP: [440, 500],
  L_KNEE: [560, 700], R_KNEE: [440, 700],
  L_ANKLE: [560, 900], R_ANKLE: [440, 900],
};

export const SITTING_FRONT: Pose = {
  NOSE: [500, 350], L_EAR: [530, 340], R_EAR: [470, 340],
  L_SHOULDER: [580, 450], R_SHOULDER: [420, 450],
  L_ELBOW: [620, 580], R_ELBOW: [380, 580],
  L_WRIST: [630, 700], R_WRIST: [370, 700],
  L_HIP: [560, 700], R_HIP: [440, 700],
  L_KNEE: [680, 740], R_KNEE: [320, 740],
  L_ANKLE: [560, 760], R_ANKLE: [440, 760],
};

// Person seen from their left side, facing image right.
export const STANDING_SIDE: Pose = {
  NOSE: [540, 150], L_EAR: [500, 140], R_EAR: [495, 140],
  L_SHOULDER: [505, 250], R_SHOULDER: [495, 250],
  L_ELBOW: [510, 370], R_ELBOW: [500, 370],
  L_WRIST: [515, 480], R_WRIST: [505, 480],
  L_HIP: [505, 500], R_HIP: [495, 500],
  L_KNEE: [505, 700], R_KNEE: [495, 700],
  L_ANKLE: [505, 900], R_ANKLE: [495, 900],
};

export const SITTING_SIDE: Pose = {
  NOSE: [440, 430], L_EAR: [400, 420], R_EAR: [395, 420],
  L_SHOULDER: [400, 450], R_SHOULDER: [395, 450],
  L_ELBOW: [420, 570], R_ELBOW: [415, 570],
  L_WRIST: [500, 690], R_WRIST: [495, 690],
  L_HIP: [400, 700], R_HIP: [395, 700],
  L_KNEE: [520, 720], R_KNEE: [515, 720],
  L_ANKLE: [450, 740], R_ANKLE: [445, 740],
};

export const with_ = (base: Pose, patch: Pose): Pose => ({ ...base, ...patch });
