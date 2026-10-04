"use client";
import { useEffect, useRef, useState } from "react";
import { postures } from "@/lib/content";
import { drawSkeleton, loadLandmarker, openCamera, runLoop } from "@/lib/pose/camera";
import { medianFrame } from "@/lib/pose/geometry";
import type { Frame, Side } from "@/lib/pose/landmarks";
import { calibrate, evaluate, type Calibration } from "@/lib/pose/rules";

/**
 * Tuning tool for the team (not linked from the app): live in-pose result for every posture,
 * and "record" to download the landmark JSON (no images) for tests/fixtures/clips/.
 */
export default function LabPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [side, setSide] = useState<Side>("R");
  const [recording, setRecording] = useState(false);
  const calibRef = useRef<Calibration | null>(null);
  const bufRef = useRef<Frame[]>([]);
  const recRef = useRef<Frame[]>([]);
  const sideRef = useRef<Side>("R");
  const recordingRef = useRef(false);

  useEffect(() => {
    sideRef.current = side;
    recordingRef.current = recording;
  }, [side, recording]);

  async function start(file?: File) {
    const video = videoRef.current!;
    const lm = await loadLandmarker();
    if (file) {
      video.src = URL.createObjectURL(file);
      video.muted = true;
      await video.play();
    } else {
      await openCamera(video);
    }
    runLoop(video, lm, (frame) => {
      if (!frame) return;
      bufRef.current = [...bufRef.current.slice(-4), frame];
      const f = medianFrame(bufRef.current);
      if (canvasRef.current) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
        drawSkeleton(canvasRef.current, f, true);
      }
      if (recordingRef.current) recRef.current.push(frame);
      const calib = calibRef.current;
      if (!calib) return;
      const next: Record<string, boolean> = {};
      for (const p of postures) next[p.id] = evaluate(p.detector.in_pose, { frame: f, calib, side: sideRef.current });
      setStatus(next);
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-4 space-y-3">
      <h1 className="text-xl font-bold">Lab: ปรับเกณฑ์กล้อง</h1>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => start()}>เปิดกล้อง</button>
        <label className="btn-ghost cursor-pointer">
          เปิดไฟล์วิดีโอ
          <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && start(e.target.files[0])} />
        </label>
        <button className="btn-ghost" onClick={() => (calibRef.current = calibrate(bufRef.current))}>คาลิเบรต (ท่าเตรียม)</button>
        <button className="btn-ghost" onClick={() => setSide(side === "L" ? "R" : "L")}>ข้างที่ทำ: {side}</button>
        <button
          className="btn-ghost"
          onClick={() => {
            if (recording) {
              const blob = new Blob([JSON.stringify(recRef.current)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `landmarks-${Date.now()}.json`;
              a.click();
              recRef.current = [];
            }
            setRecording(!recording);
          }}
        >
          {recording ? "หยุดและดาวน์โหลด" : "บันทึกจุดข้อต่อ"}
        </button>
      </div>
      <div className="relative">
        <video ref={videoRef} className="w-full -scale-x-100" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
      <ul className="grid grid-cols-2 gap-1 text-sm">
        {postures.map((p) => (
          <li key={p.id} className={status[p.id] ? "text-green-700 font-bold" : "text-stone-500"}>
            {status[p.id] ? "✅" : "·"} {p.id}
          </li>
        ))}
      </ul>
    </main>
  );
}
