"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Camera, Check, CircleCheck, CloudUpload, Pause, Phone, Play, Square, Volume2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";

/**
 * A looping motion graphic of the real patient flow, drawn in HTML so it stays sharp and light:
 * today screen → posture with voice and hold timer → pain question → result sent to the clinic.
 * Each scene remounts (key) so its CSS animations replay. Pauses off-screen, on a hidden tab,
 * under reduced motion (shows the first scene still) and with the pause button (WCAG 2.2.2).
 */
const SCENES = [
  { title: "เปิดหน้าวันนี้ กดเริ่ม", ms: 4200 },
  { title: "ทำท่าตามเสียง กล้องช่วยนับ", ms: 5600 },
  { title: "บอกระดับปวดหลังทำ", ms: 4200 },
  { title: "ผลส่งถึงคลินิกทันที", ms: 5200 },
] as const;

const DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const TODAY = 3; // พุธ

/** Inline animation helper: name, duration ms, delay ms. */
const anim = (name: string, ms: number, delay = 0, extra = "both"): CSSProperties => ({
  animation: `${name} ${ms}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms ${extra}`,
});

const REDUCE = "(prefers-reduced-motion: reduce)";
const onReduceChange = (cb: () => void) => {
  const m = window.matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function PhoneDemo() {
  const [i, setI] = useState(0);
  // Reduced motion starts paused (the server can't know, so it renders playing); once the user taps play/pause, that wins.
  const reduced = useSyncExternalStore(onReduceChange, () => window.matchMedia(REDUCE).matches, () => false);
  const [userPlaying, setUserPlaying] = useState<boolean | null>(null);
  const playing = userPlaying ?? !reduced;
  const [visible, setVisible] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting && !document.hidden));
    if (box.current) io.observe(box.current);
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const running = playing && visible;
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % SCENES.length), SCENES[i].ms);
    return () => window.clearTimeout(t);
  }, [i, running]);

  return (
    <figure ref={box} className="relative mx-auto w-[300px]">
      <span aria-hidden className="absolute -inset-12 -z-10 rounded-full bg-[radial-gradient(circle,rgb(242_193_78/0.30),transparent_62%)]" />
      <span aria-hidden className="absolute -right-6 bottom-24 -z-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(156_181_154/0.45),transparent_65%)]" />

      <div className="ph-float" style={{ animationPlayState: running ? "running" : "paused" }}>
        <div className="rounded-[46px] bg-foreground p-2.5 shadow-[0_44px_80px_-36px_rgb(35_61_44/0.65),inset_0_0_0_1.5px_rgb(255_255_255/0.12)]">
          <div aria-hidden className="ph-screen relative h-[556px] overflow-hidden rounded-[37px] bg-background" data-paused={!running || undefined}>
            <span className="absolute top-2.5 left-1/2 z-30 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-foreground" />
            <ScreenHeader />
            <div key={i} className="absolute inset-x-0 top-[96px] bottom-0" style={anim("ph-in", 520)}>
              {i === 0 && <SceneToday />}
              {i === 1 && <ScenePosture running={running} />}
              {i === 2 && <ScenePain />}
              {i === 3 && <SceneSent />}
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-6 space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUserPlaying(!playing)}
            aria-label={playing ? "หยุดภาพเคลื่อนไหว" : "เล่นภาพเคลื่อนไหว"}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-sage bg-surface text-brand shadow-soft transition active:bg-brand-tint"
          >
            {playing ? <Pause aria-hidden className="h-6 w-6" strokeWidth={2.25} /> : <Play aria-hidden className="ml-0.5 h-6 w-6" strokeWidth={2.25} />}
          </button>
          <div className="min-w-0 flex-1 space-y-1.5">
            <ol className="flex gap-1.5">
              {SCENES.map((s, n) => (
                <li key={s.title} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-sage-tint">
                  <span className="sr-only">{`${n + 1}. ${s.title}`}</span>
                  {n < i && <span className="absolute inset-0 rounded-full bg-brand-2" />}
                  {n === i && (
                    <span
                      key={`${i}-${playing}`}
                      className="absolute inset-0 origin-left rounded-full bg-brand-2"
                      style={running ? { animation: `ph-bar ${s.ms}ms linear both` } : { transform: playing ? "scaleX(0)" : "scaleX(1)" }}
                    />
                  )}
                </li>
              ))}
            </ol>
            <p className="text-base leading-snug text-muted">
              <span className="font-semibold text-brand">{i + 1}/4</span> {SCENES[i].title}
            </p>
          </div>
        </div>
        <p className="sr-only">ภาพเคลื่อนไหวจำลองหน้าจอผู้ป่วย: เปิดหน้าวันนี้ ทำท่าตามเสียง บอกระดับปวด และผลส่งถึงคลินิก</p>
      </figcaption>
    </figure>
  );
}

function ScreenHeader() {
  return (
    <div className="absolute inset-x-0 top-0 z-20 px-4 pt-11">
      <div className="flex items-center gap-2">
        <LogoMark className="h-8 w-8" />
        <div className="min-w-0 leading-tight">
          <p className="text-[13px] font-bold text-brand">การบ้านหลังนวด</p>
          <p className="truncate text-[11px] text-muted">ศูนย์สาธิต ก (ข้อมูลจำลอง)</p>
        </div>
      </div>
    </div>
  );
}

/** A translucent fingertip that glides to (x, y) inside the scene, taps at `at` ms, then fades. */
function Touch({ x, y, at, from = [210, 470] }: { x: number; y: number; at: number; from?: [number, number] }) {
  const style = {
    "--fx": `${from[0] - x}px`,
    "--fy": `${from[1] - y}px`,
    left: x - 18,
    top: y - 18,
    animation: `ph-touch 900ms cubic-bezier(0.45, 0, 0.2, 1) ${Math.max(0, at - 950)}ms both, ph-fade 400ms ease ${at + 550}ms forwards`,
  } as CSSProperties;
  return (
    <span className="pointer-events-none absolute z-30 h-9 w-9" style={style}>
      <span className="absolute inset-0 rounded-full border-2 border-white/90 bg-foreground/25 shadow-[0_4px_12px_rgb(0_0_0/0.25)]" />
      <span className="absolute inset-0 rounded-full bg-white/70" style={{ animation: `ph-ripple 600ms ease-out ${at}ms both` }} />
    </span>
  );
}

function Week({ fillToday }: { fillToday?: boolean }) {
  return (
    <ol className="grid grid-cols-7 gap-1">
      {DAYS.map((d, n) => {
        const done = n === 1 || n === 2;
        const today = n === TODAY;
        return (
          <li key={d} className="flex flex-col items-center gap-1">
            <span
              className={`relative flex h-8 w-full items-center justify-center rounded-xl ${
                done ? "bg-brand text-white" : today ? "bg-sage-tint ring-2 ring-gold" : "border border-line bg-surface"
              }`}
            >
              {done && <Check className="h-4 w-4" strokeWidth={3} />}
              {today && fillToday && (
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-brand text-white" style={anim("ph-pop", 600, 700)}>
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className={`text-[11px] leading-none ${today ? "font-bold text-foreground" : "text-muted"}`}>{today ? "วันนี้" : d}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`rounded-[22px] border border-line bg-surface p-3.5 shadow-soft ${className}`} style={style}>
      {children}
    </div>
  );
}

function SceneToday() {
  return (
    <div className="space-y-3.5 px-4">
      <div style={anim("ph-in", 600, 80)}>
        <p className="text-[12px] font-semibold text-clay-ink">วันพุธ · 7 ตุลาคม</p>
        <p className="font-display text-[27px] font-bold leading-[1.25] text-brand">
          สวัสดี<span className="text-clay-ink">ตอนเช้า</span>
        </p>
        <p className="text-[13px] text-muted">
          การบ้านวันนี้ <b className="text-foreground">4 ท่า</b> · นัดครั้งถัดไป 18 ต.ค.
        </p>
      </div>
      <div className="flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-brand text-[16px] font-semibold text-white shadow-btn" style={anim("ph-press", 380, 2350, "both")}>
        <Play className="h-5 w-5 fill-current" strokeWidth={2} />
        เริ่มทำการบ้านวันนี้
      </div>
      <Card className="space-y-2.5" style={anim("ph-in", 600, 240)}>
        <div className="flex items-baseline justify-between">
          <p className="text-[14px] font-semibold">สัปดาห์นี้</p>
          <p className="text-[12px] text-muted">
            ทำแล้ว <b className="text-foreground">2</b> จาก 5 วัน
          </p>
        </div>
        <span className="relative block h-2 overflow-hidden rounded-full bg-sage-tint">
          <span className="grow-fill absolute inset-y-0 left-0 w-2/5 origin-left rounded-full" style={anim("ph-grow", 900, 500)} />
        </span>
        <Week />
      </Card>
      <div style={anim("ph-in", 600, 380)}>
        <p className="mb-1.5 text-[13px] font-semibold">ท่าที่แพทย์แผนไทยสั่ง</p>
        <div className="grid grid-cols-2 gap-2">
          {["kae-salak-lai", "kae-kho-khlet-kae-lai-khat"].map((id) => (
            <img key={id} src={`/postures/${id}.webp`} alt="" className="h-[84px] w-full rounded-2xl border border-line object-cover object-top" />
          ))}
        </div>
      </div>
      <Touch x={150} y={108} at={2300} />
    </div>
  );
}

function ScenePosture({ running }: { running: boolean }) {
  // The hold timer, sped up for the demo: 10 → 0 in about four seconds.
  const [left, setLeft] = useState(10);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!running) return;
    const t = started
      ? window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 380)
      : window.setTimeout(() => setStarted(true), 900);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(t);
    };
  }, [running, started]);
  const C = 2 * Math.PI * 22;
  return (
    <div className="flex h-full flex-col px-4">
      <div className="flex gap-1" style={anim("ph-in", 500, 60)}>
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className={`h-2 flex-1 rounded-full ${n === 0 ? "bg-brand-2" : n === 1 ? "bg-sage-tint ring-2 ring-gold" : "bg-sage-tint"}`} />
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted">ท่าที่ 2 จาก 4</p>
      <p className="font-display text-[22px] font-bold leading-[1.3]">ท่าแก้สลักไหล่</p>
      <p className="flex items-center gap-1 text-[12px] text-muted">
        <Camera className="h-3.5 w-3.5 text-brand" strokeWidth={2.25} />
        กล้องมือถือช่วยนับเวลาค้างท่า
      </p>

      <div className="relative mt-2 overflow-hidden rounded-t-[999px] rounded-b-[22px] border border-line bg-surface shadow-soft" style={anim("ph-in", 600, 160)}>
        <img src="/postures/kae-salak-lai.webp" alt="" className="h-[170px] w-full object-cover object-[50%_40%]" />
        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full border-2 border-brand bg-surface px-2 py-0.5 text-[11px] font-semibold text-brand" style={anim("ph-pop", 500, 800)}>
          <CircleCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
          อยู่ในท่าแล้ว
        </span>
        <span className="absolute right-2 bottom-2 flex h-[58px] w-[58px] items-center justify-center rounded-full bg-surface shadow-soft" style={anim("ph-pop", 500, 700)}>
          <svg viewBox="0 0 52 52" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--sage-tint)" strokeWidth="5" />
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke="var(--brand-2)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (left / 10)}
              style={{ transition: "stroke-dashoffset 380ms linear" }}
            />
          </svg>
          <span className="relative font-display text-[19px] font-bold text-brand">{left === 0 ? <Check className="h-6 w-6" strokeWidth={3} /> : left}</span>
        </span>
      </div>

      <Card className="mt-3 flex items-center gap-2.5 py-2.5" style={anim("ph-in", 600, 300)}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
          <Volume2 className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-snug">ยกแขนซ้ายแตะไหล่ ค้างไว้ 10 วินาที</p>
          <p className="text-[10px] text-muted">เสียงอ่านโดย AI</p>
        </div>
        <span className="flex h-6 items-center gap-[3px]">
          {[0, 1, 2, 3].map((n) => (
            <span key={n} className="ph-wave h-full w-[3px] rounded-full bg-brand-2" style={{ animationDelay: `${n * 140}ms` }} />
          ))}
        </span>
      </Card>

      <div className="mt-auto -mx-4 rounded-t-[22px] border-t border-line bg-surface px-4 pt-2 pb-4 shadow-[0_-10px_24px_-16px_rgb(47_79_58/0.45)]">
        <p className="mb-1.5 text-[12px] font-semibold">รู้สึกผิดปกติ กดหยุดได้ทันที</p>
        <div className="grid grid-cols-2 gap-2">
          <span className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border-2 border-emergency text-[13px] font-semibold text-emergency">
            <Square className="h-4 w-4" strokeWidth={2.5} />
            หยุด
          </span>
          <span className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border-2 border-emergency text-[13px] font-semibold text-emergency">
            <Phone className="h-4 w-4" strokeWidth={2.5} />
            โทร 1669
          </span>
        </div>
      </div>
    </div>
  );
}

function ScenePain() {
  const tone = (n: number) => (n <= 3 ? "bg-brand-tint" : n <= 6 ? "bg-gold-tint" : "bg-gold/55");
  const PICK = 2;
  return (
    <div className="space-y-3 px-4">
      <div className="flex gap-1" style={anim("ph-in", 500, 60)}>
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className="h-2 flex-1 rounded-full bg-brand-2" />
        ))}
      </div>
      <div style={anim("ph-in", 600, 120)}>
        <p className="font-display text-[22px] font-semibold leading-[1.3]">
          หลังทำท่า
          <span className="block">ตอนนี้ปวดแค่ไหน</span>
        </p>
        <p className="text-[12px] text-muted">0 = ไม่ปวดเลย · 10 = ปวดมากที่สุด</p>
      </div>
      <div className="grid grid-cols-4 gap-2" style={anim("ph-in", 600, 240)}>
        {Array.from({ length: 11 }, (_, n) => (
          <span
            key={n}
            className={`flex h-[54px] items-center justify-center rounded-2xl font-display text-[24px] font-bold ${tone(n)}`}
            style={n === PICK ? anim("ph-select", 260, 1750) : undefined}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <span className="flex h-12 items-center justify-center rounded-full border-2 border-sage bg-surface text-[14px] font-semibold text-brand">ย้อนกลับ</span>
        <span className="flex h-12 items-center justify-center rounded-full bg-brand text-[14px] font-semibold text-white shadow-btn" style={{ animation: "ph-enable 300ms ease 1800ms both, ph-press 380ms ease 3200ms both" }}>
          ถัดไป
        </span>
      </div>
      <Touch x={170} y={160} at={1700} from={[220, 430]} />
      <Touch x={204} y={318} at={3150} from={[170, 190]} />
    </div>
  );
}

function SceneSent() {
  return (
    <div className="space-y-3 px-4">
      <Card className="flex items-center gap-3 bg-brand-tint" style={anim("ph-in", 600, 60)}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-btn" style={anim("ph-pop", 600, 200)}>
          <Check className="h-7 w-7" strokeWidth={3} />
        </span>
        <p className="leading-tight text-brand">
          <span className="block font-display text-[21px] font-bold">วันนี้ทำครบแล้ว</span>
          <span className="block text-[13px] font-semibold">ขอบคุณที่ทำการบ้าน</span>
        </p>
      </Card>
      <Card className="space-y-2.5" style={anim("ph-in", 600, 200)}>
        <div className="flex items-baseline justify-between">
          <p className="text-[14px] font-semibold">สัปดาห์นี้</p>
          <p className="text-[12px] text-muted">
            ทำแล้ว <b className="text-foreground">3</b> จาก 5 วัน
          </p>
        </div>
        <span className="relative block h-2 overflow-hidden rounded-full bg-sage-tint">
          <span className="grow-fill absolute inset-y-0 left-0 w-3/5 origin-left rounded-full" style={anim("ph-grow-from", 900, 700)} />
        </span>
        <Week fillToday />
      </Card>
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand" style={anim("ph-in", 500, 1400)}>
        <CloudUpload className="h-4 w-4" strokeWidth={2.25} />
        ส่งผลถึงคลินิกแล้ว
      </p>

      {/* What the clinic sees, sliding up over the patient screen. */}
      <div className="absolute inset-x-3 bottom-3 rounded-[22px] bg-foreground p-3.5 text-white shadow-[0_20px_40px_-20px_rgb(0_0_0/0.6)]" style={anim("ph-up", 700, 2300)}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-sage">
          <span className="h-2 w-2 rounded-full bg-gold" />
          หน้าจอคลินิก · เพิ่งอัปเดต
        </p>
        <p className="mt-1 text-[14px] font-semibold">แผน DEMO · ทำครบ 4/4 ท่า</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          {[
            ["ปวดก่อน", "5"],
            ["ปวดหลัง", "2"],
            ["ธงแดง", "ไม่มี"],
          ].map(([k, v]) => (
            <span key={k} className="rounded-xl bg-white/10 px-1 py-1.5">
              <span className="block text-[10px] text-white/75">{k}</span>
              <span className="block font-display text-[16px] font-bold">{v}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
