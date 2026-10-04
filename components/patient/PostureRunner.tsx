"use client";
import { useEffect, useRef, useState } from "react";
import { CUES, THAI_NUMBERS } from "@/lib/audio-keys";
import { speak, stopSpeaking } from "@/lib/audio";
import { creditLine, sheetUrl } from "@/lib/content";
import type { Posture } from "@/lib/content/schema";
import { withTimeout } from "@/lib/client";
import { closeCamera, drawSkeleton, loadLandmarker, openCamera, runLoop } from "@/lib/pose/camera";
import { medianFrame } from "@/lib/pose/geometry";
import type { Frame, Side } from "@/lib/pose/landmarks";
import { calibrate, evaluate, requiredVisible, type Calibration } from "@/lib/pose/rules";
import { startSession, step, toResult, type PostureResult, type SessionState } from "@/lib/pose/session";

export type DuringButton = "sharp_pain" | "dizzy" | "unsteady";

const SIDE_TH: Record<Side, string> = { L: "ข้างซ้าย", R: "ข้างขวา" };
const POSITION_TH = { sitting_floor: "นั่งพื้น", standing: "ยืน", kneeling: "คุกเข่า" } as const;

function setupTip(p: Posture): string {
  const low = p.position !== "standing";
  const where = low ? "วางมือถือตั้งพิงกับของบนพื้นหรือเก้าอี้เตี้ย สูงจากพื้นราว 20–50 ซม." : "วางมือถือตั้งพิงบนโต๊ะหรือชั้น สูงราวระดับอก";
  const view = p.detector.view === "side" ? "หันด้านข้างให้กล้อง" : "หันหน้าเข้าหากล้อง";
  return `${where} ถอยห่างราว 2 เมตร ${view} ให้เห็นทั้งตัว`;
}

type Mode = "intro" | "loading" | "setup" | "calibrate" | "run" | "button";

/** One posture: instructions → camera (setup, calibrate, hold timer) or the "ทำแล้ว" fallback. */
export function PostureRunner({ posture, onDone, onButton }: { posture: Posture; onDone: (r: PostureResult) => void; onButton: (b: DuringButton) => void }) {
  const det = posture.detector;
  const [mode, setMode] = useState<Mode>("intro");
  const [view, setView] = useState<SessionState>(() => startSession(det));
  const [inPose, setInPose] = useState(false);
  const [fps, setFps] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [offerButton, setOfferButton] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(false);
  const attemptRef = useRef(0); // bumped by every start/stop so a slow startCamera can tell it is stale
  const doneRef = useRef(false);
  const standing = posture.position === "standing";

  /** Stop the frame loop and turn the camera off (safe to call any number of times). */
  function stopCamera() {
    attemptRef.current++;
    stopRef.current?.();
    stopRef.current = null;
    closeCamera(streamRef.current);
    streamRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;
    // Runs after the previous runner's cleanup (which stops audio), so this is not cut off.
    if (standing) speak(CUES.chair_nearby);
    return () => {
      mountedRef.current = false;
      stopCamera();
      stopSpeaking();
    };
  }, [standing]);

  /** Report the result once, and never after unmount. */
  function report(r: PostureResult) {
    if (doneRef.current || !mountedRef.current) return;
    doneRef.current = true;
    onDone(r);
  }

  async function startCamera() {
    stopCamera();
    const attempt = attemptRef.current;
    const alive = () => mountedRef.current && attemptRef.current === attempt;
    setMode("loading");
    setCameraFailed(false);
    let stream: MediaStream | null = null;
    try {
      const landmarker = await withTimeout(loadLandmarker(), 20_000);
      if (!alive()) return;
      setMode("setup");
      const video = videoRef.current;
      if (!video) throw new Error("no video element");
      stream = await openCamera(video); // includes video.play()
      if (!alive()) {
        closeCamera(stream);
        return;
      }
      streamRef.current = stream;
      speak(setupTip(posture));
      let buf: Frame[] = [];
      let calibFrames: Frame[] = [];
      let calib: Calibration | null = null;
      let session = startSession(det);
      let visibleSince: number | null = null;
      let lowFpsSince: number | null = null;
      let lastSpoken = -1;
      let lastPhase = session.phase;
      let lastUi = 0;
      let lastOk = false;
      const t0 = performance.now();
      let lastDetected = t0; // last time the body was fully seen (setup) or in the pose (run)
      stopRef.current = runLoop(video, landmarker, (frame, fpsNow) => {
        if (!alive()) return;
        const now = performance.now();
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        if (fpsNow < 8 && now - t0 > 3000) lowFpsSince ??= now;
        else lowFpsSince = null;
        if (lowFpsSince && now - lowFpsSince > 5000) setOfferButton(true);
        if (now - lastDetected > 15_000) setOfferButton(true); // any phase

        if (frame) buf = [...buf.slice(-4), frame];
        const f = frame ? medianFrame(buf) : null;

        if (!calib) {
          if (!f) {
            drawSkeleton(canvas, null, false);
            return;
          }
          const seeAll = requiredVisible(det, f, session.side);
          drawSkeleton(canvas, f, seeAll);
          if (!seeAll) {
            visibleSince = null;
            calibFrames = [];
            setHint(CUES.get_in_frame);
            return;
          }
          lastDetected = now;
          visibleSince ??= now;
          if (now - visibleSince < 1000) return;
          if (calibFrames.length === 0) {
            setMode("calibrate");
            setHint(CUES.hold_still);
            speak(CUES.hold_still);
          }
          calibFrames.push(f);
          if (now - visibleSince >= 3000) {
            calib = calibrate(calibFrames);
            if (calib) {
              setMode("run");
              setHint(null);
              speak(posture.steps_th[1] ?? posture.name_th);
            } else {
              visibleSince = null;
              calibFrames = [];
            }
          }
          return;
        }

        // No person in this frame: still a frame out of the pose, so the hold pauses after the grace time.
        const ok = f ? evaluate(det.in_pose, { frame: f, calib, side: session.side }) : false;
        if (ok) lastDetected = now;
        session = step(det, session, now, ok);
        drawSkeleton(canvas, f, ok);

        if (session.phase === "hold" && det.mode === "hold") {
          const sec = Math.floor(session.heldMs / 1000);
          if (sec !== lastSpoken && sec >= 1 && sec <= THAI_NUMBERS.length) {
            lastSpoken = sec;
            speak(THAI_NUMBERS[sec - 1]);
          }
        }
        if (session.phase !== lastPhase) {
          if (session.phase === "hold" && lastPhase === "ready") {
            lastSpoken = 0;
            speak(det.mode === "hold" ? CUES.start_hold : posture.name_th);
          }
          if (session.phase === "release") speak(det.sides === "alternate" ? `${CUES.release} ${CUES.switch_side}` : CUES.release);
          if (session.phase === "done") {
            speak(CUES.posture_done);
            stopCamera();
            report(toResult(posture.id, session));
            return;
          }
          lastPhase = session.phase;
        }
        if (now - lastUi > 100 || ok !== lastOk) {
          lastOk = ok;
          lastUi = now;
          setView(session);
          setInPose(ok);
          setFps(fpsNow);
        }
      });
    } catch {
      if (stream && streamRef.current !== stream) closeCamera(stream);
      if (!alive()) return;
      stopCamera();
      setCameraFailed(true);
      setMode("button");
    }
  }

  function useButtons() {
    stopCamera();
    setMode("button");
  }

  const holdMs = det.hold_seconds * 1000;
  const progress = Math.min(1, view.heldMs / holdMs);

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold">{posture.name_th}</h2>
      <p className="text-sm text-stone-600">
        {POSITION_TH[posture.position]} · {det.mode === "hold" ? `ค้าง ${det.hold_seconds} วินาที` : "นับเป็นครั้ง"} · {det.units}{" "}
        {det.sides === "alternate" ? "ครั้ง (สลับซ้าย-ขวา)" : "รอบ"}
        {det.difficulty === "hard" && " · กล้องช่วยนับ (ทดลอง)"}
      </p>

      {(mode === "intro" || mode === "button") && (
        <>
          <a href={`/postures/${posture.id}.webp`} target="_blank" rel="noreferrer">
            <img src={`/postures/${posture.id}.webp`} alt={`แผ่นท่า${posture.name_th}`} className="w-full rounded-xl border" />
          </a>
          <ol className="list-decimal pl-6 space-y-1">
            {posture.steps_th.map((s, i) => (
              <li key={i}>
                {s}{" "}
                <button className="text-brand" aria-label="ฟัง" onClick={() => speak(s)}>
                  🔊
                </button>
              </li>
            ))}
          </ol>
          {standing && <p className="card border-2 border-yellow-400 bg-yellow-50 text-lg font-semibold">🪑 {CUES.chair_nearby}</p>}
          {posture.note_th && <p className="text-sm text-stone-600">{posture.note_th}</p>}
          {posture.cautions_th.length > 0 && <p className="text-sm text-orange-800">ข้อควรระวัง: {posture.cautions_th.join(" / ")}</p>}
          <p className="text-xs text-stone-500">
            {creditLine(posture)} ·{" "}
            <a className="underline" href={sheetUrl(posture.source.sheet)} target="_blank" rel="noreferrer">
              ดูต้นฉบับ
            </a>{" "}
            · เสียงอ่านสร้างด้วย AI (Gemini) จากข้อความในแผ่นของกรมฯ
          </p>
        </>
      )}

      {mode === "intro" && (
        <div className="grid gap-2">
          <button className="btn text-xl" onClick={startCamera}>
            📷 เริ่มโดยใช้กล้องช่วยนับ
          </button>
          <button className="btn-ghost" onClick={useButtons}>
            ไม่ใช้กล้อง
          </button>
          <p className="text-xs text-stone-500">ภาพจากกล้องประมวลผลในมือถือเท่านั้น ไม่ถูกบันทึกหรือส่งออก</p>
        </div>
      )}

      {(mode === "loading" || mode === "setup" || mode === "calibrate" || mode === "run") && (
        <div className="space-y-2">
          {mode === "loading" && <p>กำลังเตรียมกล้อง…</p>}
          {mode !== "loading" && <p className="text-sm">{setupTip(posture)}</p>}
          <div className="relative w-full overflow-hidden rounded-xl bg-black">
            {/* iOS: keep the video visible (never display:none) */}
            <video ref={videoRef} className="w-full -scale-x-100" playsInline muted />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            {mode === "run" && (
              <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-3 py-2 text-lg font-semibold">
                {inPose ? "✅ อยู่ในท่า" : "ยังไม่อยู่ในท่า"} · {view.unitsDone}/{view.unitsTarget}
                {view.side && ` · ${SIDE_TH[view.side]}`}
              </div>
            )}
            {mode === "run" && det.mode === "hold" && (
              <svg className="absolute right-3 top-3" width="88" height="88" viewBox="0 0 88 88" aria-label="เวลาค้างท่า">
                <circle cx="44" cy="44" r="38" stroke="#ffffff88" strokeWidth="10" fill="none" />
                <circle
                  cx="44" cy="44" r="38" stroke="#16a34a" strokeWidth="10" fill="none"
                  strokeDasharray={`${2 * Math.PI * 38}`} strokeDashoffset={`${2 * Math.PI * 38 * (1 - progress)}`}
                  transform="rotate(-90 44 44)"
                />
                <text x="44" y="52" textAnchor="middle" fontSize="24" fill="white" fontWeight="700">
                  {Math.ceil((holdMs - view.heldMs) / 1000)}
                </text>
              </svg>
            )}
          </div>
          {hint && <p className="text-lg font-semibold">{hint}</p>}
          {mode === "run" && view.phase === "paused" && <p className="text-orange-700">หยุดเวลาไว้ กลับเข้าท่าเพื่อนับต่อ</p>}
          <p className="text-xs text-stone-500">{fps} ภาพ/วินาที</p>
          {offerButton ? (
            <button className="btn-ghost w-full" onClick={useButtons}>
              กล้องจับไม่ได้? ใช้ปุ่ม “ทำแล้ว” แทน
            </button>
          ) : (
            <button className="btn-ghost w-full text-sm" onClick={useButtons}>
              ใช้ปุ่มแทน
            </button>
          )}
        </div>
      )}

      {mode === "button" && cameraFailed && <p className="text-orange-700">ใช้กล้องไม่ได้ ใช้ปุ่มแทน</p>}
      {mode === "button" && <ButtonMode posture={posture} onDone={report} />}

      <div className="grid grid-cols-3 gap-2 pt-2">
        <button className="btn-ghost border-red-400 text-red-800" onClick={() => onButton("sharp_pain")}>
          ปวดแปล๊บ
        </button>
        <button className="btn-ghost border-orange-400 text-orange-800" onClick={() => onButton("dizzy")}>
          เวียนหัว
        </button>
        <button className="btn-ghost border-yellow-500 text-yellow-800" disabled={posture.position !== "standing"} onClick={() => onButton("unsteady")}>
          เซ
        </button>
      </div>
    </div>
  );
}

/** Fallback without camera: a plain timer per unit, then "ทำแล้ว". */
function ButtonMode({ posture, onDone }: { posture: Posture; onDone: (r: PostureResult) => void }) {
  const det = posture.detector;
  const [unit, setUnit] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const finish = (secondsHeld: number) =>
    onDone({ posture_id: posture.id, method: "button", units_done: det.units, units_target: det.units, seconds_held: secondsHeld });

  useEffect(() => {
    if (left === null) return;
    if (left === 0) {
      speak(CUES.release);
      const t = setTimeout(() => {
        setLeft(null);
        setUnit((u) => u + 1);
      }, 0);
      return () => clearTimeout(t);
    }
    // Count elapsed seconds from the second tick, so the first tick does not cut off "เริ่มค้างท่า".
    const elapsed = det.hold_seconds - left;
    if (elapsed >= 1 && elapsed <= THAI_NUMBERS.length) speak(THAI_NUMBERS[elapsed - 1]);
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, det.hold_seconds]);

  const side = det.sides === "alternate" && det.first_side ? (unit % 2 === 0 ? det.first_side : det.first_side === "L" ? "R" : "L") : null;
  return (
    <div className="card space-y-3">
      <p className="text-lg">
        ครั้งที่ {Math.min(unit + 1, det.units)} จาก {det.units}
        {side && ` · ${SIDE_TH[side]}`}
      </p>
      {unit < det.units ? (
        <button
          className="btn w-full text-xl"
          disabled={left !== null}
          onClick={() => {
            speak(CUES.start_hold);
            setLeft(det.hold_seconds);
          }}
        >
          {left !== null ? `ค้างไว้… ${left}` : det.mode === "hold" ? `เริ่มค้าง ${det.hold_seconds} วินาที` : "เริ่มครั้งนี้"}
        </button>
      ) : (
        <button className="btn w-full text-xl" onClick={() => finish(det.units * det.hold_seconds)}>
          ✅ ทำครบแล้ว
        </button>
      )}
      <button className="btn-ghost w-full" onClick={() => finish(0)}>
        ทำครบแล้ว (ข้ามตัวจับเวลา)
      </button>
    </div>
  );
}
