"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import {
  CalendarPlus, Check, ChevronDown, ChevronRight, CircleCheck, Clock, CloudUpload, House, ListChecks, LogOut, Play, RotateCcw, Settings, Trash2, Volume2, WifiOff, X,
} from "lucide-react";
import { CUES } from "@/lib/audio-keys";
import { speak, unlockAudio } from "@/lib/audio";
import { api, thaiDate, todayLocal } from "@/lib/client";
import { getGroup, getPosture, rulesAskedAt } from "@/lib/content";
import { enqueue, flush, forgetPlan, loadPlan, pendingCount, savePlan } from "@/lib/offline";
import type { PostureResult } from "@/lib/pose/session";
import {
  advance,
  applyRaise,
  classifySubmit,
  emptyRun,
  flagsFor,
  isRetryableStatus,
  sessionBody,
  skippedResult,
  stopRun,
  stopsNow,
  visibleFlags,
  type RunData,
  type SessionBody,
} from "@/lib/patient-run";
import { ruleById, worst, type ClinicRuleSettings, type FiredFlag } from "@/lib/redflags";
import { PostureRunner, type DuringButton } from "@/components/patient/PostureRunner";
import { PainScale, YesNoQuestions } from "@/components/patient/Questions";
import { FlagMessage, SpeakOnce } from "@/components/patient/Outcome";
import { SessionWarp, WeekCloth, type Thread } from "@/components/patient/Weave";

interface Plan {
  code: string;
  status: "active" | "completed" | "stopped";
  group_ids: string[];
  posture_ids: string[];
  days_per_week: number;
  remind_time: string;
  start_date: string;
  next_visit_date: string;
  consent_at: string | null;
  clinic: { name: string; phone: string | null };
  settings: ClinicRuleSettings;
  done_days?: string[]; // absent in a plan cached before the week strip existed
}

/** sending → sent | queued (offline outbox) | saveFailed (outbox failed) | notSent (server refused, e.g. 400/401/403/410). */
type SaveState = "sending" | "sent" | "queued" | "saveFailed" | "notSent";

type Stage =
  | { s: "loading" }
  | { s: "error"; msg: string }
  | { s: "consent" }
  | { s: "home" }
  | { s: "pre" }
  | { s: "pain_before" }
  | { s: "ask_before_posture"; i: number }
  | { s: "posture"; i: number }
  | { s: "dizzy_check"; i: number }
  | { s: "pause"; i: number; ruleId: string }
  | { s: "pain_after" }
  | { s: "post" }
  | { s: "result"; runId: string; flags: FiredFlag[]; save: SaveState };

const lastDoneKey = (code: string) => `hp:last:${code}`;
const stopKey = (code: string) => `hp:stop:${code}`; // {day, rule}: today's run was stopped for safety
const isStop = (f: FiredFlag | null | undefined) => f?.level === "call_1669" || f?.level === "stop_and_contact_clinic";

export default function PatientPage() {
  const { code } = useParams<{ code: string }>();
  const [secret, setSecret] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stage, setStage] = useState<Stage>({ s: "loading" });
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);
  const [doneToday, setDoneToday] = useState(false);
  const [stopToday, setStopToday] = useState<FiredFlag | null>(null); // a stop-level outcome today: home shows it, never "do it again"
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]); // per posture this run: done / skipped, for the header warp
  const [question, setQuestion] = useState<{ i: number; n: number } | null>(null); // "ข้อ i จาก n" for the header
  const onQuestion = useCallback((i: number, n: number) => setQuestion((q) => (q?.i === i && q?.n === n ? q : { i, n })), []);
  // The run in progress lives in refs and is passed explicitly to every step: never read from a stale render.
  const run = useRef<RunData>(emptyRun());
  const clientId = useRef(""); // one per run: a retry or a second tap never makes a second session
  const finishing = useRef(false); // set once finish() ran for this run
  const cursor = useRef<number | null>(null); // posture index currently on screen (null = none)
  const paused = useRef<number | null>(null); // posture index whose pause card is on screen

  const load = useCallback(async (sec: string) => {
    const r = await api<Plan>(`/api/p/${code}/plan`, { body: { secret: sec } });
    let p: Plan | null = null;
    if (r.ok) {
      p = r.data;
      await savePlan(code, p);
      setOffline(false);
      await flush(code, sec);
    } else if (isRetryableStatus(r.status)) {
      p = await loadPlan<Plan>(code); // offline, rate-limited or server error: last plan seen online
      setOffline(true);
    } else {
      return setStage({ s: "error", msg: r.message_th ?? "ลิงก์นี้ใช้ไม่ได้แล้ว โปรดติดต่อคลินิก" });
    }
    if (!p) return setStage({ s: "error", msg: "ยังไม่มีอินเทอร์เน็ต เปิดลิงก์นี้อีกครั้งเมื่อออนไลน์" });
    setPlan(p);
    setPending(await pendingCount(code));
    try {
      setDoneToday(localStorage.getItem(lastDoneKey(code)) === todayLocal());
      const stop = JSON.parse(localStorage.getItem(stopKey(code)) ?? "null") as { day: string; flag: FiredFlag } | null;
      setStopToday(stop?.day === todayLocal() ? stop.flag : null);
    } catch {}
    if (p.status !== "active") return setStage({ s: "error", msg: "แผนนี้ปิดแล้ว ขอบคุณที่ทำการบ้าน หากมีอาการผิดปกติโปรดติดต่อคลินิก" });
    setStage(p.consent_at ? { s: "home" } : { s: "consent" });
  }, [code]);

  useEffect(() => {
    const sec = window.location.hash.slice(1);
    const t = setTimeout(() => {
      if (!sec) return setStage({ s: "error", msg: "ลิงก์ไม่ครบ โปรดสแกน QR บนใบนัดอีกครั้ง" });
      setSecret(sec);
      load(sec);
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  /** Show the outcome at once (never wait on the network), then submit in the background. Runs once per run. */
  function finish(data: RunData) {
    if (!plan || finishing.current) return;
    finishing.current = true;
    cursor.current = null;
    paused.current = null;
    run.current = data;
    const flags = flagsFor(data, plan.settings);
    const body = sessionBody(data, clientId.current, todayLocal());
    const w = worst(flags);
    if (isStop(w)) {
      // A stopped day is not a done day: it is struck on the week strip and home shows the stop, not a repeat run.
      try {
        localStorage.setItem(stopKey(code), JSON.stringify({ day: todayLocal(), flag: w }));
      } catch {}
      setStopToday(w);
    } else if (data.results.some((x) => x.method !== "skipped")) {
      try {
        localStorage.setItem(lastDoneKey(code), todayLocal());
      } catch {}
      setDoneToday(true);
    }
    setStage({ s: "result", runId: body.client_id, flags, save: "sending" });
    void submit(body);
  }

  async function submit(body: SessionBody) {
    const r = await api(`/api/p/${code}/sessions`, { body: { secret, session: body } });
    let save: SaveState = "sent";
    const outcome = classifySubmit(r.ok, r.status);
    if (outcome === "retry") {
      save = (await enqueue({ code, body })) ? "queued" : "saveFailed";
      setPending(await pendingCount(code));
    } else if (outcome === "rejected") {
      save = "notSent";
    }
    setStage((st) => (st.s === "result" && st.runId === body.client_id ? { ...st, save } : st));
  }

  /** A red flag answered "yes" for posture i: stop everything, or pause just this posture. */
  function raise(ruleId: string, i: number) {
    if (!plan || finishing.current || cursor.current !== i) return;
    const out = applyRaise(run.current, ruleId, i, plan.posture_ids, plan.settings);
    run.current = out.run;
    if (out.kind === "stop") return finish(out.run);
    if (out.kind === "pause") {
      cursor.current = null; // late onDone/onButton from this posture are ignored
      paused.current = i;
      return setStage({ s: "pause", i, ruleId: out.ruleId });
    }
    advanceFrom(i, skippedResult(plan.posture_ids[i]));
  }

  /** After the pause card: posture i is skipped (and, after RF11, every later standing posture). */
  function continueAfterPause(i: number) {
    if (!plan || finishing.current || paused.current !== i) return;
    paused.current = null;
    advanceFrom(i, skippedResult(plan.posture_ids[i]));
  }

  /** Posture i finished (camera or button). Ignored if it is no longer the posture on screen. */
  function postureDone(i: number, r: PostureResult) {
    if (!plan || finishing.current || cursor.current !== i) return;
    advanceFrom(i, r);
  }

  function advanceFrom(i: number, r: PostureResult) {
    if (!plan) return;
    const out = advance(run.current, plan.posture_ids, i, r);
    run.current = out.run;
    setThreads((t) => t.map((x, k) => (k === i ? (r.method === "skipped" ? "skipped" : "done") : x)));
    if (out.next === null) {
      cursor.current = null;
      setStage({ s: "pain_after" });
    } else {
      goPosture(out.next);
    }
  }

  function goPosture(i: number) {
    cursor.current = i;
    const id = plan!.posture_ids[i];
    setStage(rulesAskedAt("before_posture", id).length ? { s: "ask_before_posture", i } : { s: "posture", i });
  }

  function startRun() {
    unlockAudio();
    run.current = emptyRun();
    clientId.current = crypto.randomUUID();
    finishing.current = false;
    cursor.current = null;
    paused.current = null;
    setActionError(null);
    setThreads(plan ? plan.posture_ids.map(() => undefined) : []);
    setStage({ s: "pre" });
  }

  /** Leave today's run from the header: nothing is sent, and late callbacks from the screen being left are ignored. */
  function leaveRun() {
    if (!confirm("ออกจากการบ้านวันนี้? รอบนี้จะยังไม่ถูกส่งให้คลินิก")) return;
    finishing.current = true;
    cursor.current = null;
    paused.current = null;
    setStage({ s: "home" });
  }

  if (stage.s === "loading") return <main className="flex flex-1 items-center justify-center p-6 text-xl text-muted">กำลังเปิดแผน…</main>;
  if (stage.s === "error")
    return (
      <main className="mx-auto w-full max-w-xl p-6">
        <p className="card text-[22px] leading-[1.7]">{stage.msg}</p>
      </main>
    );
  if (!plan) return null;

  const total = plan.posture_ids.length;
  const doneDays = doneToday ? [...(plan.done_days ?? []), todayLocal()] : (plan.done_days ?? []);
  const week = { doneDays, today: todayLocal(), daysPerWeek: plan.days_per_week, stoppedToday: !!stopToday };
  const inRun = stage.s !== "consent" && stage.s !== "home";
  const q = question && question.n > 1 ? `ข้อ ${question.i + 1} จาก ${question.n}` : "";
  const runStep = (() => {
    switch (stage.s) {
      case "pre":
        return { label: "ก่อนเริ่ม", count: q, current: null };
      case "pain_before":
        return { label: "ระดับปวดก่อนเริ่ม", current: null };
      case "ask_before_posture":
        return { label: `ก่อนท่า${getPosture(plan.posture_ids[stage.i]).name_th.replace(/^ท่า/, "")}`, count: q, current: stage.i };
      case "posture":
      case "dizzy_check":
      case "pause":
        return { label: `ท่าที่ ${stage.i + 1} จาก ${total}`, current: stage.i };
      case "pain_after":
        return { label: "ระดับปวดหลังทำท่า", current: null };
      case "post":
        return { label: "หลังทำท่า", count: q, current: null };
      default: {
        const w = stage.s === "result" ? worst(stage.flags) : null;
        const stopped = w?.level === "call_1669" || w?.level === "stop_and_contact_clinic";
        return { label: stopped ? "หยุดการบ้านวันนี้" : "จบการบ้านวันนี้", current: null };
      }
    }
  })();

  return (
    <main className="flex-1 text-[20px]">
      {inRun ? (
        <header className="bg-brand text-white">
          <div className="mx-auto max-w-xl space-y-3 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-semibold leading-[1.4]">
                {runStep.label}
                {"count" in runStep && runStep.count && <span className="whitespace-nowrap"> · {runStep.count}</span>}
              </p>
              {stage.s !== "result" && (
                <button className="inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 border-white/70 px-4 text-lg font-semibold focus-visible:outline-gold active:bg-brand-deep" onClick={leaveRun}>
                  <LogOut aria-hidden className="h-6 w-6" strokeWidth={2} />
                  ออก
                </button>
              )}
            </div>
            {stage.s !== "result" && <SessionWarp threads={threads.length === total ? threads : plan.posture_ids.map(() => undefined)} current={runStep.current} />}
          </div>
          <div className="selvedge" />
        </header>
      ) : (
        <header className="bg-brand text-white">
          <div className="mx-auto max-w-xl px-5 pt-5 pb-5">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-lg text-white/90">{plan.clinic.name}</p>
              <span className="shrink-0 rounded-full border-2 border-white/60 px-3 py-0.5 text-lg font-semibold" aria-label={`รหัสแผน ${plan.code}`}>
                {plan.code}
              </span>
            </div>
            <p className="font-display text-[31px] font-bold leading-[1.3]">การบ้านหลังนวด</p>
          </div>
          {offline && (
            <div className="mx-auto max-w-xl px-5 pb-4">
              <p className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-1 text-lg font-semibold text-foreground">
                <WifiOff aria-hidden className="h-5 w-5" strokeWidth={2} />
                ออฟไลน์
              </p>
            </div>
          )}
          <div className="selvedge" />
        </header>
      )}

      <div className="mx-auto max-w-xl space-y-8 px-5 py-6">
        {stage.s === "consent" && (
          <section className="space-y-6">
            <h1 className="font-display text-[31px] font-bold leading-[1.35]">ก่อนเริ่ม โปรดอ่าน</h1>
            <button className="btn-ghost w-full border-indigo/70 text-xl text-indigo active:bg-indigo-tint" onClick={() => speak(CONSENT_TH.join(" "))}>
              <Volume2 aria-hidden className="h-7 w-7" strokeWidth={2} />
              ฟังข้อความนี้
            </button>
            <ul className="space-y-4">
              {CONSENT_TH.map((t) => (
                <li key={t} className="flex gap-3 leading-[1.7]">
                  <span aria-hidden className="mt-3 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
                  {t}
                </li>
              ))}
            </ul>
            <button
              className="btn min-h-[72px] w-full font-display text-[28px]"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setActionError(null);
                const r = await api<{ consent_at: string }>(`/api/p/${code}/consent`, { body: { secret } });
                setBusy(false);
                if (r.ok) {
                  setPlan({ ...plan, consent_at: r.data.consent_at });
                  setStage({ s: "home" });
                } else {
                  setActionError(`บันทึกความยินยอมไม่สำเร็จ ${r.message_th ?? ""} ลองใหม่อีกครั้ง`);
                }
              }}
            >
              ยินยอมและเริ่มใช้งาน
            </button>
            {actionError && <p className="font-semibold text-emergency">{actionError}</p>}
          </section>
        )}

        {stage.s === "home" && (
          <>
            <section className="space-y-4">
              <div>
                <h1 className="font-display text-[39px] font-bold leading-[1.25]">การบ้านวันนี้</h1>
                <p className="text-xl text-muted">
                  {total} ท่า · นัดครั้งถัดไป <span className="font-semibold text-foreground">{thaiDate(plan.next_visit_date)}</span>
                </p>
              </div>
              {stopToday ? (
                <>
                  <p className="text-[22px] font-semibold">วันนี้หยุดการบ้านแล้ว</p>
                  <FlagMessage flag={stopToday} clinicPhone={plan.clinic.phone} />
                </>
              ) : (
                <>
                  {doneToday && (
                    <p className="flex items-center gap-2 rounded-2xl bg-brand-tint px-4 py-3 text-xl font-semibold text-brand">
                      <CircleCheck aria-hidden className="h-7 w-7" strokeWidth={2.25} />
                      วันนี้ทำแล้ว
                    </p>
                  )}
                  <button className="btn min-h-[76px] w-full font-display text-[28px]" onClick={startRun}>
                    {doneToday ? <RotateCcw aria-hidden className="h-8 w-8" strokeWidth={2.25} /> : <Play aria-hidden className="h-8 w-8 fill-current" strokeWidth={2} />}
                    {doneToday ? "ทำอีกรอบ" : "เริ่มทำการบ้านวันนี้"}
                  </button>
                </>
              )}
            </section>

            <WeekCloth {...week} />

            <section aria-labelledby="postures-heading" className="space-y-3">
              <h2 id="postures-heading" className="text-[25px] font-semibold leading-[1.35]">ท่าที่แพทย์แผนไทยสั่ง</h2>
              <ol className="rounded-3xl border-2 border-line bg-surface">
                {plan.posture_ids.map((id, i) => {
                  const p = getPosture(id);
                  const d = p.detector;
                  return (
                    <li key={id} className={i > 0 ? "border-t-2 border-line" : ""}>
                      {i === 0 && (
                        <div className="overflow-hidden rounded-t-[22px]">
                          <img src={`/postures/${id}.webp`} alt="" className="aspect-[16/10] w-full object-cover object-[50%_42%]" />
                        </div>
                      )}
                      <div className="flex items-center gap-3 p-4">
                        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className={i === 0 ? "text-[22px] font-semibold" : "text-xl"}>{p.name_th}</p>
                          {i === 0 && (
                            <p className="text-lg text-muted">
                              {d.mode === "hold" ? `ค้าง ${d.hold_seconds} วินาที` : "นับเป็นครั้ง"} · {d.units} {d.sides === "alternate" ? "ครั้ง (สลับซ้าย-ขวา)" : "รอบ"}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="space-y-3">
              <dl className="space-y-3 rounded-3xl border-2 border-line bg-surface p-5">
                <div className="flex items-start gap-3">
                  <ListChecks aria-hidden className="mt-1 h-7 w-7 shrink-0 text-indigo" strokeWidth={2} />
                  <div>
                    <dt className="text-lg text-muted">กลุ่มอาการ</dt>
                    <dd className="text-[22px] font-semibold">{plan.group_ids.map((g) => getGroup(g).name_th).join(" + ")}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock aria-hidden className="mt-1 h-7 w-7 shrink-0 text-indigo" strokeWidth={2} />
                  <div>
                    <dt className="text-lg text-muted">ทำการบ้าน</dt>
                    <dd className="text-[22px] font-semibold">
                      {plan.days_per_week === 7 ? "ทุกวัน" : `สัปดาห์ละ ${plan.days_per_week} วัน`} เวลา {plan.remind_time}
                    </dd>
                  </div>
                </div>
              </dl>
              <a className="btn-ghost w-full text-xl" href={`/api/p/${code}/calendar?k=${encodeURIComponent(secret)}`}>
                <CalendarPlus aria-hidden className="h-7 w-7" strokeWidth={2} />
                เพิ่มลงปฏิทิน (เตือนทุกครั้ง)
              </a>
              {pending > 0 && (
                <button className="btn-ghost w-full text-xl" onClick={async () => { await flush(code, secret); setPending(await pendingCount(code)); }}>
                  <CloudUpload aria-hidden className="h-7 w-7" strokeWidth={2} />
                  ส่งผลที่ค้างอยู่ ({pending})
                </button>
              )}
            </section>

            <details className="group rounded-3xl border-2 border-line">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 text-lg font-semibold text-muted">
                <Settings aria-hidden className="h-6 w-6" strokeWidth={2} />
                ตั้งค่า
                <ChevronDown aria-hidden className="ml-auto h-6 w-6 transition-transform group-open:rotate-180" strokeWidth={2} />
              </summary>
              <div className="space-y-3 px-5 pb-5">
                <button
                  className="btn-ghost w-full border-emergency text-lg text-emergency active:bg-emergency-tint"
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm("ลบข้อมูลทั้งหมดของแผนนี้และหยุดใช้งาน?")) return;
                    setBusy(true);
                    setActionError(null);
                    const r = await api(`/api/p/${code}/delete`, { body: { secret } });
                    setBusy(false);
                    if (r.ok) {
                      await forgetPlan(code);
                      try {
                        localStorage.removeItem(lastDoneKey(code));
                        localStorage.removeItem(stopKey(code));
                      } catch {}
                      setStage({ s: "error", msg: "ลบข้อมูลของคุณแล้ว แผนนี้หยุดใช้งาน" });
                    } else {
                      setActionError(`ลบข้อมูลไม่สำเร็จ ${r.message_th ?? ""} ลองใหม่อีกครั้ง`);
                    }
                  }}
                >
                  <Trash2 aria-hidden className="h-6 w-6" strokeWidth={2} />
                  ลบข้อมูลของฉัน
                </button>
                {actionError && <p className="font-semibold text-emergency">{actionError}</p>}
              </div>
            </details>
          </>
        )}

        {stage.s === "pre" && (
          <section>
            <YesNoQuestions
              key="pre"
              rules={rulesAskedAt("pre")}
              onIndex={onQuestion}
              onBack={() => setStage({ s: "home" })}
              onDone={(a) => {
                if (finishing.current) return;
                const data = { ...run.current, answers: { ...run.current.answers, ...a } };
                run.current = data;
                if (stopsNow(data, plan.settings)) return finish(stopRun(data, plan.posture_ids));
                setStage({ s: "pain_before" });
              }}
            />
          </section>
        )}

        {stage.s === "pain_before" && (
          <PainScale
            title="ตอนนี้ปวดแค่ไหน (ก่อนทำท่า)"
            onBack={() => setStage({ s: "pre" })}
            onDone={(v) => {
              if (finishing.current) return;
              const data = { ...run.current, painBefore: v };
              run.current = data;
              if (stopsNow(data, plan.settings)) return finish(stopRun(data, plan.posture_ids));
              goPosture(0);
            }}
          />
        )}

        {stage.s === "ask_before_posture" && (
          <section>
            <YesNoQuestions
              key={`before-${stage.i}`}
              rules={rulesAskedAt("before_posture", plan.posture_ids[stage.i])}
              onIndex={onQuestion}
              onDone={(a) => {
                if (finishing.current || cursor.current !== stage.i) return;
                run.current = { ...run.current, answers: { ...run.current.answers, ...a } }; // "no" answers too
                const yes = Object.entries(a).find(([, v]) => v)?.[0];
                if (yes) return raise(yes, stage.i);
                setStage({ s: "posture", i: stage.i });
              }}
            />
          </section>
        )}

        {stage.s === "posture" && (
          <PostureRunner
            key={plan.posture_ids[stage.i]}
            posture={getPosture(plan.posture_ids[stage.i])}
            onDone={(r) => postureDone(stage.i, r)}
            onButton={(b: DuringButton) => {
              if (b === "sharp_pain") raise("RF04", stage.i);
              else if (b === "unsteady") raise("RF11", stage.i);
              else if (!finishing.current && cursor.current === stage.i) setStage({ s: "dizzy_check", i: stage.i });
            }}
          />
        )}

        {stage.s === "dizzy_check" && (
          <section className="space-y-5">
            <p className="text-[24px] font-semibold leading-[1.6]">
              อาการเวียนหัว เกิดขึ้นทันทีและรุนแรง หรือมีหน้าเบี้ยว แขนขาอ่อนแรง พูดไม่ชัด ร่วมด้วยไหม
            </p>
            <button className="flex min-h-20 w-full items-center justify-center gap-3 rounded-[20px] bg-emergency text-[25px] font-semibold text-white active:brightness-90" onClick={() => raise("RF01", stage.i)}>
              <Check aria-hidden className="h-8 w-8" strokeWidth={2.5} />
              ใช่
            </button>
            <button className="btn-ghost min-h-20 w-full text-[22px]" onClick={() => raise("RF10", stage.i)}>
              <X aria-hidden className="h-8 w-8" strokeWidth={2.5} />
              ไม่ใช่ เวียนหัวเล็กน้อย
            </button>
          </section>
        )}

        {stage.s === "pause" && (
          <section className="space-y-5">
            <SpeakOnce key={`${stage.i}:${stage.ruleId}`} text={ruleById(stage.ruleId).patient_message_th} />
            <FlagMessage
              flag={{ rule_id: stage.ruleId, level: ruleById(stage.ruleId).level, posture_id: plan.posture_ids[stage.i] }}
              clinicPhone={plan.clinic.phone}
            />
            <button className="btn min-h-16 w-full text-[22px]" onClick={() => continueAfterPause(stage.i)}>
              พักแล้ว ทำท่าถัดไป
              <ChevronRight aria-hidden className="h-7 w-7" strokeWidth={2} />
            </button>
          </section>
        )}

        {stage.s === "pain_after" && (
          <PainScale
            title="หลังทำท่า ตอนนี้ปวดแค่ไหน"
            onDone={(v) => {
              if (finishing.current) return;
              run.current = { ...run.current, painAfter: v };
              setStage({ s: "post" });
            }}
          />
        )}

        {stage.s === "post" && (
          <section>
            <YesNoQuestions key="post" rules={rulesAskedAt("post")} onIndex={onQuestion} onDone={(a) => finish({ ...run.current, answers: { ...run.current.answers, ...a } })} />
          </section>
        )}

        {stage.s === "result" && <Result key={stage.runId} stage={stage} clinicPhone={plan.clinic.phone} week={week} onHome={() => setStage({ s: "home" })} />}
      </div>
    </main>
  );
}

const CONSENT_TH = [
  "แอปจะเก็บ: วันที่ทำ ท่าที่ทำ ค้างครบหรือไม่ ระดับปวด และคำตอบเรื่องอาการ",
  "แอปไม่เก็บ: ภาพจากกล้อง ชื่อ เบอร์โทร หรือเลขประจำตัวผู้ป่วย ภาพจากกล้องประมวลผลในมือถือเท่านั้น",
  "ข้อมูลเก็บที่เซิร์ฟเวอร์ในสิงคโปร์ (ต่างประเทศ) และลบเมื่อปิดแผนครบ 90 วัน",
  "คลินิกที่ออกใบนัดเห็นข้อมูลของแผนนี้ กรมการแพทย์แผนไทยฯ เห็นเฉพาะตัวเลขรวม",
  "ถอนความยินยอมและลบข้อมูลได้ทุกเมื่อ ที่ปุ่ม “ลบข้อมูลของฉัน”",
  "แอปนี้ไม่ได้ตรวจโรคหรือรักษา ท่าทั้งหมดมาจากแผ่นของกรมฯ ตามที่แพทย์แผนไทยสั่ง",
  "ผู้ป่วยอายุต่ำกว่า 18 ปี ให้ผู้ปกครองเป็นผู้กดยินยอม",
];

/** The outcome: shown at once; the save line updates when the background submit settles. */
function Result({
  stage,
  clinicPhone,
  week,
  onHome,
}: {
  stage: Extract<Stage, { s: "result" }>;
  clinicPhone: string | null;
  week: ComponentProps<typeof WeekCloth>;
  onHome: () => void;
}) {
  const w = worst(stage.flags);
  const shown = visibleFlags(stage.flags); // after a stop-level flag only that level: no reassuring cards next to 1669
  const stopped = w?.level === "call_1669" || w?.level === "stop_and_contact_clinic";
  return (
    <section className="space-y-6">
      {/* Only the worst message is spoken, once per run (the save-state update does not remount this). */}
      <SpeakOnce text={w ? ruleById(w.rule_id).patient_message_th : CUES.session_done} />
      {!w && stage.save !== "notSent" && (
        <div className="flex items-center gap-4 rounded-3xl border-2 border-brand bg-brand-tint p-5">
          <CircleCheck aria-hidden className="h-12 w-12 shrink-0 text-brand" strokeWidth={2} />
          {/* Same words as the spoken cue, set as a headline and its line of thanks. */}
          <p className="text-brand">
            <span className="block font-display text-[31px] font-bold leading-[1.3]">{CUES.session_done.split(" ")[0]}</span>
            <span className="block text-[22px] font-semibold">{CUES.session_done.split(" ").slice(1).join(" ")}</span>
          </p>
        </div>
      )}
      {shown.map((f) => (
        <FlagMessage key={f.rule_id} flag={f} clinicPhone={clinicPhone} />
      ))}
      {/* Today's band weaves into the week; a stop strikes it. The 1669 screen keeps its one job. */}
      {w?.level !== "call_1669" && <WeekCloth {...week} weaveToday={!stopped} stoppedToday={stopped} />}
      <div aria-live="polite" className="space-y-3">
        {stage.save === "sending" && <p className="text-muted">กำลังส่งผล…</p>}
        {stage.save === "queued" && <p className="font-semibold text-indigo">ยังส่งผลไม่ได้ (ไม่มีอินเทอร์เน็ต) แอปจะส่งให้อัตโนมัติเมื่อเปิดลิงก์อีกครั้ง</p>}
        {stage.save === "saveFailed" && <p className="font-semibold text-indigo">ยังส่งผลไม่ได้ และเก็บผลไว้ในมือถือไม่สำเร็จ โปรดแจ้งคลินิกเมื่อพบกันครั้งหน้า</p>}
        {stage.save === "notSent" && <p className="rounded-3xl border-2 border-emergency bg-emergency-tint p-5 text-[22px] font-semibold text-emergency">ส่งผลไม่สำเร็จ โปรดแจ้งคลินิก</p>}
      </div>
      <button className="btn-ghost min-h-16 w-full text-xl" onClick={onHome}>
        <House aria-hidden className="h-7 w-7" strokeWidth={2} />
        กลับหน้าแรก
      </button>
    </section>
  );
}
