// Copy the MediaPipe wasm files and download the pose model into public/mediapipe/ (self-hosted, pinned).
// Run: node scripts/fetch-mediapipe.mjs
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "mediapipe");
const wasmSrc = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
mkdirSync(path.join(out, "wasm"), { recursive: true });
for (const f of readdirSync(wasmSrc)) copyFileSync(path.join(wasmSrc, f), path.join(out, "wasm", f));

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const modelPath = path.join(out, "pose_landmarker_lite.task");
if (!existsSync(modelPath)) {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed: ${res.status}`);
  writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()));
}
console.log("mediapipe ready:", readdirSync(path.join(out, "wasm")).length, "wasm files + pose_landmarker_lite.task");
