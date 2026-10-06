"use client";
import { useEffect, useRef, useState } from "react";
import {
  Armchair, Camera, CameraOff, Check, CircleAlert, CircleCheck, Hand, PersonStanding, RefreshCw, Repeat, ShieldCheck, Timer, UserRound, Volume2, Zap, ZoomIn,
  type LucideIcon,
} from "lucide-react";
import { CUES, setupTip, THAI_NUMBERS } from "@/lib/audio-keys";
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

type Mode = "intro" | "loading" | "setup" | "calibrate" | "run" | "button";

/** One posture: instructions → camera (setup, calibrate, hold timer) or the "ทำแล้ว" fallback. */
export function PostureRunner({ posture, onDone, onButton }: { posture: Posture; onDone: (r: PostureResult) => void; onButton: (b: DuringButton) => void }) {
  const det = posture.detector;
  const PositionIcon = posture.position === "standing" ? PersonStanding : UserRound;
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
      let tipDone = false; // the get-in-frame cue never cuts off the setup tip
      void withTimeout(speak(setupTip(posture)), 15_000)
        .catch(() => {})
        .finally(() => {
          tipDone = true;
        });
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
      let calibFails = 0;
      let outSince: number | null = null; // body not fully seen since (setup)
      let lastFrameCue = -Infinity;
      const t0 = performance.now();
      let lastDetected = t0; // last time the body was fully seen (setup) or in the pose (run)
      /** Say "get in frame" at most every 12 s: a patient 2 m away may not be able to read the screen. */
      const frameCue = (now: number) => {
        if (!tipDone || now - lastFrameCue < 12_000) return;
        lastFrameCue = now;
        speak(CUES.get_in_frame);
      };
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
        if (now - lastDetected > 15_000) {
          setOfferButton(true); // any phase
          // Before calibration, also show and say why (covers frames with no body found at all).
          if (!calib) {
            setHint(CUES.get_in_frame);
            frameCue(now);
          }
        }

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
            outSince ??= now;
            if (now - outSince > 4000) frameCue(now);
            return;
          }
          outSince = null;
          lastDetected = now;
          visibleSince ??= now;
          if (now - visibleSince < 1000) return;
          if (calibFrames.length === 0) {
            setMode("calibrate");
            // After two failed tries keep trying without "hold still", so the get-in-frame cue below is not cut off.
            if (calibFails < 2) {
              setHint(CUES.hold_still);
              speak(CUES.hold_still);
            }
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
              if (++calibFails === 2) {
                setOfferButton(true);
                setHint(CUES.get_in_frame);
                lastFrameCue = now;
                speak(CUES.get_in_frame);
              }
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
          if (session.phase === "release") {
            const switchSide = det.sides === "alternate" && session.unitsDone < session.unitsTarget; // not after the last unit
            speak(switchSide ? CUES.release_switch : CUES.release);
          }
          if (session.phase === "done") {
            // Let "ครบแล้ว เก่งมาก" play before moving on (at most 3 s); a stop or "ใช้ปุ่มแทน" tap meanwhile wins.
            stopCamera();
            const after = attemptRef.current;
            const r = toResult(posture.id, session);
            setView(session);
            setHint(CUES.posture_done);
            void withTimeout(speak(CUES.posture_done), 3000)
              .catch(() => {})
              .finally(() => {
                if (attemptRef.current === after) report(r);
              });
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
      }, () => {
        // The model or a frame threw: same as a camera that fails to start.
        if (!alive()) return;
        stopCamera();
        setCameraFailed(true);
        setMode("button");
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
    <div className="space-y-6 pb-52">
      <header className="space-y-2">
        <h1 className="font-display text-[31px] font-bold leading-[1.35]">{posture.name_th}</h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-lg text-muted">
          <span className="inline-flex items-center gap-1.5">
            <PositionIcon aria-hidden className="h-6 w-6 text-brand" strokeWidth={2} />
            {POSITION_TH[posture.position]}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Timer aria-hidden className="h-6 w-6 text-brand" strokeWidth={2} />
            {det.mode === "hold" ? `ค้าง ${det.hold_seconds} วินาที` : "นับเป็นครั้ง"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Repeat aria-hidden className="h-6 w-6 text-brand" strokeWidth={2} />
            {det.units} {det.sides === "alternate" ? "ครั้ง (สลับซ้าย-ขวา)" : "รอบ"}
          </span>
          {det.difficulty === "hard" && <span>กล้องช่วยนับ (ทดลอง)</span>}
        </p>
      </header>

      {mode === "button" && cameraFailed && <p className="text-xl font-semibold text-indigo">ใช้กล้องไม่ได้ ใช้ปุ่มแทน</p>}
      {mode === "button" && <ButtonMode posture={posture} onDone={report} />}

      {(mode === "intro" || mode === "button") && (
        <>
          {standing && (
            <p className="flex items-start gap-3 rounded-3xl border-2 border-gold bg-gold-tint p-5 text-[22px] font-semibold leading-[1.5] shadow-soft">
              <Armchair aria-hidden className="mt-0.5 h-8 w-8 shrink-0" strokeWidth={2} />
              {CUES.chair_nearby}
            </p>
          )}
          <a href={`/postures/${posture.id}.webp`} target="_blank" rel="noreferrer" className="block space-y-2">
            <img src={`/postures/${posture.id}.webp`} alt={`แผ่นท่า${posture.name_th}`} className="w-full rounded-3xl border border-line shadow-soft" />
            <span className="flex items-center gap-2 text-base text-indigo">
              <ZoomIn aria-hidden className="h-5 w-5" strokeWidth={2} />
              แตะภาพเพื่อดูแผ่นเต็ม
            </span>
          </a>
          {/* Start sits right under the sheet, which already shows the steps in pictures; the text steps follow for reference. */}
          {mode === "intro" && (
            <div className="grid gap-3">
              <button className="btn min-h-16 text-[22px]" onClick={startCamera}>
                <Camera aria-hidden className="h-7 w-7" strokeWidth={2} />
                เริ่มโดยใช้กล้องช่วยนับ
              </button>
              <button className="btn-ghost text-xl" onClick={useButtons}>
                <CameraOff aria-hidden className="h-7 w-7" strokeWidth={2} />
                ไม่ใช้กล้อง
              </button>
              <p className="flex items-start gap-2 text-base text-muted">
                <ShieldCheck aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brand" strokeWidth={2} />
                ภาพจากกล้องประมวลผลในมือถือเท่านั้น ไม่ถูกบันทึกหรือส่งออก
              </p>
            </div>
          )}
          <section aria-labelledby="steps-heading" className="space-y-3">
            <h2 id="steps-heading" className="text-[25px] font-semibold leading-[1.35]">ขั้นตอน</h2>
            <ol className="divide-y divide-line rounded-3xl border border-line bg-surface shadow-soft">
              {posture.steps_th.map((s, i) => (
                <li key={i} className="flex gap-3 p-4">
                  <span aria-hidden className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sage-tint text-lg font-bold text-brand">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="text-xl leading-[1.7]">{s}</p>
                    <button
                      className="inline-flex min-h-14 items-center gap-2 rounded-full border-2 border-sage px-5 text-lg font-semibold text-indigo active:bg-indigo-tint"
                      aria-label={`ฟังขั้นที่ ${i + 1}`}
                      onClick={() => speak(s)}
                    >
                      <Volume2 aria-hidden className="h-6 w-6" strokeWidth={2} />
                      ฟัง
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          {posture.note_th && <p className="text-lg text-muted">{posture.note_th}</p>}
          {posture.cautions_th.length > 0 && (
            <div className="card space-y-2">
              <p className="flex items-center gap-2 text-xl font-semibold">
                <CircleAlert aria-hidden className="h-6 w-6 text-indigo" strokeWidth={2} />
                ข้อควรระวัง
              </p>
              <ul className="list-disc space-y-1 pl-6 text-lg">
                {posture.cautions_th.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-base leading-[1.6] text-muted">
            {creditLine(posture)} ·{" "}
            <a className="font-semibold text-indigo underline underline-offset-4" href={sheetUrl(posture.source.sheet)} target="_blank" rel="noreferrer">
              ดูต้นฉบับ
            </a>{" "}
            · เสียงอ่านสร้างด้วย AI (Gemini) จากข้อความในแผ่นของกรมฯ
          </p>
        </>
      )}

      {(mode === "loading" || mode === "setup" || mode === "calibrate" || mode === "run") && (
        <div className="space-y-3">
          {mode === "loading" && <p className="text-xl">กำลังเตรียมกล้อง…</p>}
          {mode !== "loading" && <p className="text-lg">{setupTip(posture)}</p>}
          <div className="relative w-full overflow-hidden rounded-3xl bg-foreground shadow-soft">
            {/* iOS: keep the video visible (never display:none) */}
            <video ref={videoRef} className="w-full -scale-x-100" playsInline muted />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            {mode === "run" && (
              <div className={`absolute left-3 top-3 rounded-2xl border-2 bg-surface px-3 py-2 text-xl font-semibold ${inPose ? "border-brand text-brand" : "border-line text-foreground"}`}>
                {inPose && <CircleCheck aria-hidden className="mr-1.5 inline h-6 w-6 align-[-4px]" strokeWidth={2.5} />}
                {inPose ? "อยู่ในท่า" : "ยังไม่อยู่ในท่า"} · {view.unitsDone}/{view.unitsTarget}
                {view.side && ` · ${SIDE_TH[view.side]}`}
              </div>
            )}
            {mode === "run" && det.mode === "hold" && (
              <svg className="absolute right-3 top-3" width="96" height="96" viewBox="0 0 88 88" aria-label="เวลาค้างท่า">
                <circle cx="44" cy="44" r="38" fill="#1f2f25b3" stroke="#fbfcf866" strokeWidth="10" />
                <circle
                  cx="44" cy="44" r="38" stroke="#f2c14e" strokeWidth="10" fill="none" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 38}`} strokeDashoffset={`${2 * Math.PI * 38 * (1 - progress)}`}
                  transform="rotate(-90 44 44)"
                />
                <text x="44" y="53" textAnchor="middle" fontSize="28" fill="white" fontWeight="700">
                  {Math.ceil((holdMs - view.heldMs) / 1000)}
                </text>
              </svg>
            )}
          </div>
          {hint && <p className="text-[22px] font-semibold">{hint}</p>}
          {mode === "run" && view.phase === "paused" && <p className="text-xl font-semibold text-indigo">หยุดเวลาไว้ กลับเข้าท่าเพื่อนับต่อ</p>}
          <p className="text-base text-muted">{fps} ภาพ/วินาที</p>
          <button className="btn-ghost w-full text-xl" onClick={useButtons}>
            <Hand aria-hidden className="h-7 w-7" strokeWidth={2} />
            {offerButton ? "กล้องจับไม่ได้? ใช้ปุ่ม “ทำแล้ว” แทน" : "ใช้ปุ่มแทน"}
          </button>
        </div>
      )}


      {/* Stopping is always one tap away: fixed to the bottom, never scrolled out of reach. */}
      <div className="fixed inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-line bg-surface shadow-[0_-12px_30px_-18px_rgb(47_79_58/0.45)]">
        <div className="mx-auto max-w-xl px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
          <p className="mb-2 text-xl font-semibold">รู้สึกผิดปกติ กดหยุดได้ทันที</p>
          <div className={`grid gap-3 ${standing ? "grid-cols-3" : "grid-cols-2"}`}>
            <StopButton icon={Zap} label="ปวดแปล๊บ" onClick={() => onButton("sharp_pain")} />
            <StopButton icon={RefreshCw} label="เวียนหัว" onClick={() => onButton("dizzy")} />
            {standing && <StopButton icon={PersonStanding} label="เซ" onClick={() => onButton("unsteady")} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function StopButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      className="flex min-h-[72px] flex-col items-center justify-center gap-0.5 rounded-3xl border-2 border-emergency bg-surface px-1 text-xl font-semibold leading-tight text-emergency active:bg-emergency-tint"
      onClick={onClick}
    >
      <Icon aria-hidden className="h-6 w-6 shrink-0" strokeWidth={2.25} />
      {label}
    </button>
  );
}

/** Fallback without camera: a plain timer per unit, then "ทำแล้ว". */
function ButtonMode({ posture, onDone }: { posture: Posture; onDone: (r: PostureResult) => void }) {
  const det = posture.detector;
  const [unit, setUnit] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // The timer sits above the instructions; bring it into view when it replaces the camera buttons further down.
  useEffect(() => {
    boxRef.current?.scrollIntoView({ block: "center" });
  }, []);
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
    <div ref={boxRef} className="card space-y-4">
      <p className="text-[25px] font-semibold leading-[1.35]">
        ครั้งที่ {Math.min(unit + 1, det.units)} จาก {det.units}
        {side && ` · ${SIDE_TH[side]}`}
      </p>
      {unit < det.units ? (
        <button
          className="btn min-h-20 w-full font-display text-[28px]"
          disabled={left !== null}
          onClick={() => {
            speak(CUES.start_hold);
            setLeft(det.hold_seconds);
          }}
        >
          {left !== null ? `ค้างไว้… ${left}` : det.mode === "hold" ? `เริ่มค้าง ${det.hold_seconds} วินาที` : "เริ่มครั้งนี้"}
        </button>
      ) : (
        <button className="btn min-h-20 w-full font-display text-[28px]" onClick={() => finish(det.units * det.hold_seconds)}>
          <Check aria-hidden className="h-8 w-8" strokeWidth={2.5} />
          ทำครบแล้ว
        </button>
      )}
      <button className="btn-ghost w-full text-xl" onClick={() => finish(0)}>
        ทำครบแล้ว (ข้ามตัวจับเวลา)
      </button>
    </div>
  );
}
