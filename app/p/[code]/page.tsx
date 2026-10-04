"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CUES } from "@/lib/audio-keys";
import { unlockAudio } from "@/lib/audio";
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

export default function PatientPage() {
  const { code } = useParams<{ code: string }>();
  const [secret, setSecret] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stage, setStage] = useState<Stage>({ s: "loading" });
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);
  const [doneToday, setDoneToday] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
    if (data.results.some((x) => x.method !== "skipped")) {
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
    setStage({ s: "pre" });
  }

  if (stage.s === "loading") return <main className="p-6 text-center">กำลังเปิดแผน…</main>;
  if (stage.s === "error") return <main className="p-6"><p className="card text-xl">{stage.msg}</p></main>;
  if (!plan) return null;

  return (
    <main className="mx-auto max-w-xl px-4 py-5 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-sm text-stone-500">{plan.clinic.name}</div>
          <div className="font-semibold">การบ้านหลังนวด · {plan.code}</div>
        </div>
        {offline && <span className="rounded-full bg-orange-100 px-3 py-1 text-sm">ออฟไลน์</span>}
      </header>

      {stage.s === "consent" && (
        <section className="card space-y-3">
          <h1 className="text-xl font-bold">ก่อนเริ่ม โปรดอ่าน</h1>
          <ul className="list-disc pl-5 space-y-1">
            <li>แอปจะเก็บ: วันที่ทำ ท่าที่ทำ ค้างครบหรือไม่ ระดับปวด และคำตอบเรื่องอาการ</li>
            <li>แอปไม่เก็บ: ภาพจากกล้อง ชื่อ เบอร์โทร หรือเลขประจำตัวผู้ป่วย ภาพจากกล้องประมวลผลในมือถือเท่านั้น</li>
            <li>ข้อมูลเก็บที่เซิร์ฟเวอร์ในสิงคโปร์ (ต่างประเทศ) และลบเมื่อปิดแผนครบ 90 วัน</li>
            <li>คลินิกที่ออกใบนัดเห็นข้อมูลของแผนนี้ กรมการแพทย์แผนไทยฯ เห็นเฉพาะตัวเลขรวม</li>
            <li>ถอนความยินยอมและลบข้อมูลได้ทุกเมื่อ ที่ปุ่ม “ลบข้อมูลของฉัน”</li>
            <li>แอปนี้ไม่ได้ตรวจโรคหรือรักษา ท่าทั้งหมดมาจากแผ่นของกรมฯ ตามที่แพทย์แผนไทยสั่ง</li>
            <li>ผู้ป่วยอายุต่ำกว่า 18 ปี ให้ผู้ปกครองเป็นผู้กดยินยอม</li>
          </ul>
          <button
            className="btn w-full text-xl"
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
          {actionError && <p className="text-red-700">{actionError}</p>}
        </section>
      )}

      {stage.s === "home" && (
        <section className="space-y-3">
          <div className="card space-y-2">
            <p>
              {plan.group_ids.map((g) => getGroup(g).name_th).join(" + ")} ·{" "}
              {plan.days_per_week === 7 ? "ทุกวัน" : `สัปดาห์ละ ${plan.days_per_week} วัน`} เวลา {plan.remind_time}
            </p>
            <p>นัดครั้งถัดไป {thaiDate(plan.next_visit_date)}</p>
            <ol className="list-decimal pl-6">
              {plan.posture_ids.map((id) => (
                <li key={id}>{getPosture(id).name_th}</li>
              ))}
            </ol>
            {doneToday && <p className="text-green-700 font-semibold">✅ วันนี้ทำแล้ว</p>}
          </div>
          <button className="btn w-full text-2xl py-5" onClick={startRun}>
            ▶ เริ่มทำการบ้านวันนี้
          </button>
          <a className="btn-ghost w-full" href={`/api/p/${code}/calendar?k=${encodeURIComponent(secret)}`}>
            📅 เพิ่มลงปฏิทิน (เตือนทุกครั้ง)
          </a>
          {pending > 0 && (
            <button className="btn-ghost w-full" onClick={async () => { await flush(code, secret); setPending(await pendingCount(code)); }}>
              ส่งผลที่ค้างอยู่ ({pending})
            </button>
          )}
          <details className="text-sm text-stone-600">
            <summary>ตั้งค่า</summary>
            <button
              className="btn-ghost mt-2 border-red-300 text-red-800"
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
                  } catch {}
                  setStage({ s: "error", msg: "ลบข้อมูลของคุณแล้ว แผนนี้หยุดใช้งาน" });
                } else {
                  setActionError(`ลบข้อมูลไม่สำเร็จ ${r.message_th ?? ""} ลองใหม่อีกครั้ง`);
                }
              }}
            >
              ลบข้อมูลของฉัน
            </button>
            {actionError && <p className="mt-2 text-red-700">{actionError}</p>}
          </details>
        </section>
      )}

      {stage.s === "pre" && (
        <section className="space-y-3">
          <h1 className="text-xl font-bold">ก่อนเริ่ม ตอบคำถามเรื่องอาการ</h1>
          <YesNoQuestions
            rules={rulesAskedAt("pre")}
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
        <section className="space-y-3">
          <h2 className="text-xl font-bold">ก่อนท่า{getPosture(plan.posture_ids[stage.i]).name_th.replace(/^ท่า/, "")}</h2>
          <YesNoQuestions
            rules={rulesAskedAt("before_posture", plan.posture_ids[stage.i])}
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
        <section className="card space-y-3">
          <p className="text-xl">อาการเวียนหัว เกิดขึ้นทันทีและรุนแรง หรือมีหน้าเบี้ยว แขนขาอ่อนแรง พูดไม่ชัด ร่วมด้วยไหม</p>
          <button className="btn w-full bg-red-700 text-xl" onClick={() => raise("RF01", stage.i)}>
            ใช่
          </button>
          <button className="btn-ghost w-full text-xl" onClick={() => raise("RF10", stage.i)}>
            ไม่ใช่ เวียนหัวเล็กน้อย
          </button>
        </section>
      )}

      {stage.s === "pause" && (
        <section className="space-y-3">
          <SpeakOnce key={`${stage.i}:${stage.ruleId}`} text={ruleById(stage.ruleId).patient_message_th} />
          <FlagMessage
            flag={{ rule_id: stage.ruleId, level: ruleById(stage.ruleId).level, posture_id: plan.posture_ids[stage.i] }}
            clinicPhone={plan.clinic.phone}
          />
          <button className="btn w-full text-xl" onClick={() => continueAfterPause(stage.i)}>
            พักแล้ว ทำท่าถัดไป
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
        <section className="space-y-3">
          <h1 className="text-xl font-bold">หลังทำท่า</h1>
          <YesNoQuestions rules={rulesAskedAt("post")} onDone={(a) => finish({ ...run.current, answers: { ...run.current.answers, ...a } })} />
        </section>
      )}

      {stage.s === "result" && <Result key={stage.runId} stage={stage} clinicPhone={plan.clinic.phone} onHome={() => setStage({ s: "home" })} />}
    </main>
  );
}

/** The outcome: shown at once; the save line updates when the background submit settles. */
function Result({ stage, clinicPhone, onHome }: { stage: Extract<Stage, { s: "result" }>; clinicPhone: string | null; onHome: () => void }) {
  const w = worst(stage.flags);
  const shown = visibleFlags(stage.flags); // after a stop-level flag only that level: no reassuring cards next to 1669
  return (
    <section className="space-y-3">
      {/* Only the worst message is spoken, once per run (the save-state update does not remount this). */}
      <SpeakOnce text={w ? ruleById(w.rule_id).patient_message_th : CUES.session_done} />
      {!w && stage.save !== "notSent" && <p className="card text-xl">✅ {CUES.session_done}</p>}
      {shown.map((f) => (
        <FlagMessage key={f.rule_id} flag={f} clinicPhone={clinicPhone} />
      ))}
      {stage.save === "sending" && <p className="text-stone-500">กำลังส่งผล…</p>}
      {stage.save === "queued" && <p className="text-orange-700">ยังส่งผลไม่ได้ (ไม่มีอินเทอร์เน็ต) แอปจะส่งให้อัตโนมัติเมื่อเปิดลิงก์อีกครั้ง</p>}
      {stage.save === "saveFailed" && <p className="text-orange-700">ยังส่งผลไม่ได้ และเก็บผลไว้ในมือถือไม่สำเร็จ โปรดแจ้งคลินิกเมื่อพบกันครั้งหน้า</p>}
      {stage.save === "notSent" && <p className="card text-xl text-red-800">ส่งผลไม่สำเร็จ โปรดแจ้งคลินิก</p>}
      <button className="btn-ghost w-full" onClick={onHome}>
        กลับหน้าแรก
      </button>
    </section>
  );
}
