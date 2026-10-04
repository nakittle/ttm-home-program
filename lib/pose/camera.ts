"use client";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Frame } from "./landmarks";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/** Load the pose model once (self-hosted under /mediapipe). GPU first, CPU if the GPU path fails. */
export function loadLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const make = (delegate: "GPU" | "CPU") =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task", delegate },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      try {
        return await make("GPU");
      } catch {
        return await make("CPU");
      }
    })();
    landmarkerPromise.catch(() => {
      landmarkerPromise = null;
    });
  }
  return landmarkerPromise;
}

/** Front camera stream. Throws if the user denies permission; never leaves the camera on when it throws. */
export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  try {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true; // iOS: never hide the <video> with display:none
    await video.play();
    return stream;
  } catch (e) {
    closeCamera(stream);
    if (video.srcObject === stream) video.srcObject = null;
    throw e;
  }
}

export function closeCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Run the model on every animation frame and hand each Frame to `onFrame`.
 * Frames stay on the device: nothing here is uploaded. Returns a stop function.
 */
export function runLoop(video: HTMLVideoElement, landmarker: PoseLandmarker, onFrame: (f: Frame | null, fps: number) => void): () => void {
  let raf = 0;
  let stopped = false;
  let lastTs = -1;
  const times: number[] = [];
  const tick = () => {
    if (stopped) return;
    const now = performance.now();
    if (video.readyState >= 2 && now !== lastTs) {
      lastTs = now;
      const res = landmarker.detectForVideo(video, now);
      times.push(now);
      while (times.length && now - times[0] > 1000) times.shift();
      const lm = res.landmarks[0];
      const frame: Frame | null = lm
        ? { t: now, width: video.videoWidth, height: video.videoHeight, points: lm.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility ?? 0 })) }
        : null;
      onFrame(frame, times.length);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/** Draw the skeleton over the video (mirrored like a selfie view). */
const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

export function drawSkeleton(canvas: HTMLCanvasElement, frame: Frame | null, ok: boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frame) return;
  const X = (x: number) => (1 - x) * canvas.width;
  const Y = (y: number) => y * canvas.height;
  ctx.lineWidth = 6;
  ctx.strokeStyle = ok ? "#16a34a" : "#f59e0b";
  for (const [a, b] of BONES) {
    const p = frame.points[a];
    const q = frame.points[b];
    if (p.visibility < 0.5 || q.visibility < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(X(p.x), Y(p.y));
    ctx.lineTo(X(q.x), Y(q.y));
    ctx.stroke();
  }
}
