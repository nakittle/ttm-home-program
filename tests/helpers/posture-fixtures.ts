import type { LandmarkName, Side } from "@/lib/pose/landmarks";
import { SITTING_FRONT, SITTING_SIDE, STANDING_FRONT, STANDING_SIDE, with_, type Pose } from "./skeleton";

export interface Fixture {
  neutral: Pose; // calibration (starting) position
  inPose: Pose;
  side: Side | null; // active side the inPose frame shows
  dim?: LandmarkName[]; // points with low visibility (to choose the visible side)
}

const SIDE_DIM: LandmarkName[] = ["R_SHOULDER", "R_ELBOW", "R_WRIST", "R_HIP", "R_KNEE", "R_ANKLE"];

/** Hand-made frames that should satisfy each posture's rule (and the neutral frame should not). */
export const FIXTURES: Record<string, Fixture> = {
  "kae-kiat": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { L_WRIST: [400, 520], R_WRIST: [380, 520], L_ELBOW: [520, 500], R_ELBOW: [380, 480] }),
    side: "R",
  },
  "kae-lom-puat-sisa": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { L_WRIST: [505, 250], R_WRIST: [495, 250], L_ELBOW: [600, 320], R_ELBOW: [400, 320] }),
    side: "L",
  },
  "kae-lom-wian-sisa": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { L_ELBOW: [640, 400], L_WRIST: [560, 340] }),
    side: "R",
  },
  "kae-lom-pakang": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { R_WRIST: [500, 400], R_ELBOW: [430, 470], L_WRIST: [510, 300], L_ELBOW: [620, 440] }),
    side: "R",
  },
  "kae-puat-thong-sabak-chom": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { L_WRIST: [700, 330], R_WRIST: [300, 330], L_ELBOW: [650, 440], R_ELBOW: [350, 440] }),
    side: null,
  },
  "kae-sabak-na-chom": {
    neutral: SITTING_FRONT,
    inPose: with_(SITTING_FRONT, { NOSE: [500, 330], L_WRIST: [600, 690], R_WRIST: [400, 690] }),
    side: null,
  },
  "kae-salak-lai": {
    neutral: STANDING_FRONT,
    inPose: with_(STANDING_FRONT, { L_WRIST: [560, 260], L_ELBOW: [520, 330], R_WRIST: [530, 340], R_ELBOW: [440, 380] }),
    side: "L",
  },
  "kae-kho-khlet-kae-lai-khat": {
    neutral: STANDING_FRONT,
    inPose: with_(STANDING_FRONT, {
      NOSE: [500, 210], L_SHOULDER: [580, 310], R_SHOULDER: [420, 310],
      L_ELBOW: [640, 380], R_ELBOW: [360, 380], L_WRIST: [560, 380], R_WRIST: [440, 380],
      L_HIP: [560, 560], R_HIP: [440, 560], L_KNEE: [640, 700], R_KNEE: [360, 700],
    }),
    side: null,
  },
  "kae-lom-nai-ok-nai-eo": {
    neutral: STANDING_SIDE,
    inPose: with_(STANDING_SIDE, { R_WRIST: [300, 160], L_ANKLE: [430, 900], R_ANKLE: [600, 900], L_HIP: [505, 530], R_HIP: [495, 530] }),
    side: "R",
  },
  "kae-khao-khat": {
    neutral: SITTING_SIDE,
    inPose: with_(SITTING_SIDE, { L_KNEE: [550, 700], L_ANKLE: [700, 700], L_WRIST: [500, 680] }),
    side: null,
    dim: SIDE_DIM,
  },
  "kae-klon": {
    neutral: SITTING_SIDE,
    inPose: with_(SITTING_SIDE, { L_KNEE: [550, 700], L_ANKLE: [700, 700], L_WRIST: [680, 690], NOSE: [560, 560] }),
    side: null,
    dim: SIDE_DIM,
  },
  "kae-khao-kae-kha": {
    neutral: STANDING_SIDE,
    inPose: with_(STANDING_SIDE, {
      L_HIP: [505, 540], R_HIP: [495, 540], L_KNEE: [620, 720], L_ANKLE: [600, 900], R_KNEE: [450, 720], R_ANKLE: [420, 900],
    }),
    side: "R",
  },
  "damrong-kai-ayu-yuen": {
    neutral: STANDING_FRONT,
    inPose: with_(STANDING_FRONT, {
      NOSE: [500, 210], L_SHOULDER: [580, 310], R_SHOULDER: [420, 310],
      L_WRIST: [505, 380], R_WRIST: [495, 400], L_ELBOW: [600, 400], R_ELBOW: [400, 400],
      L_HIP: [560, 560], R_HIP: [440, 560], L_KNEE: [660, 700], R_KNEE: [340, 700], L_ANKLE: [620, 900], R_ANKLE: [380, 900],
    }),
    side: null,
  },
};
