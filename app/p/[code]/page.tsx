"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CUES } from "@/lib/audio-keys";
import { speak, unlockAudio } from "@/lib/audio";
import { api, thaiDate, todayLocal } from "@/lib/client";
import { getGroup, getPosture, rulesAskedAt } from "@/lib/content";
import { enqueue, flush, forgetPlan, loadPlan, pendingCount, savePlan } from "@/lib/offline";
import type { PostureResult } from "@/lib/pose/session";
import { evaluateRedFlags, stopsSession, worst, type Answers, type ClinicRuleSettings, type FiredFlag } from "@/lib/redflags";
import { PostureRunner, type DuringButton } from "@/components/patient/PostureRunner";
import { PainScale, YesNoQuestions } from "@/components/patient/Questions";
import { FlagMessage } from "@/components/patient/Outcome";

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
  | { s: "pain_after" }
  | { s: "post" }
  | { s: "result"; flags: FiredFlag[]; queued: boolean; saveFailed: boolean };

const lastDoneKey = (code: string) => `hp:last:${code}`;

export default function PatientPage() {
  const { code } = useParams<{ code: string }>();
  const [secret, setSecret] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stage, setStage] = useState<Stage>({ s: "loading" });
  const [answers, setAnswers] = useState<Answers>({});
  const [postureFlags, setPostureFlags] = useState<{ rule_id: string; posture_id: string }[]>([]);
  const [results, setResults] = useState<PostureResult[]>([]);
  const [painBefore, setPainBefore] = useState<number | null>(null);
  const [painAfter, setPainAfter] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);
  const [doneToday, setDoneToday] = useState(false);

  const load = useCallback(async (sec: string) => {
    const r = await api<Plan>(`/api/p/${code}/plan`, { body: { secret: sec } });
    let p: Plan | null = null;
    if (r.ok) {
      p = r.data;
      await savePlan(code, p);
      setOffline(false);
      await flush(code, sec);
    } else if (r.status === 0) {
      p = await loadPlan<Plan>(code); // offline: last plan seen online
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

  /** Submit (or queue when offline) and show the outcome. */
  async function finish(extra: { answers?: Answers; painBefore?: number | null; painAfter?: number | null; results?: PostureResult[] }) {
    if (!plan) return;
    const a = { ...answers, ...(extra.answers ?? {}) };
    const before = extra.painBefore !== undefined ? extra.painBefore : painBefore;
    const res = extra.results ?? results;
    const body = {
      client_id: crypto.randomUUID(),
      performed_on: todayLocal(),
      pain_before: before,
      pain_after: extra.painAfter ?? null,
      results: res,
      answers: a,
      posture_flags: postureFlags,
    };
    const flags = evaluateRedFlags({ answers: a, painBefore: before, painAfter: extra.painAfter ?? null }, plan.settings);
    let queued = false;
    let saveFailed = false;
    const r = await api(`/api/p/${code}/sessions`, { body: { secret, session: body } });
    if (!r.ok && (r.status === 0 || r.status >= 500)) {
      queued = await enqueue({ code, body });
      saveFailed = !queued;
      setPending(await pendingCount(code));
    }
    if (res.some((x) => x.method !== "skipped")) {
      try {
        localStorage.setItem(lastDoneKey(code), todayLocal());
      } catch {}
      setDoneToday(true);
    }
    if (!flags.length) speak(CUES.session_done);
    setStage({ s: "result", flags, queued, saveFailed });
  }

  /** A red flag answered mid-session: stop everything, or pause just this posture. */
  function raise(ruleId: string, postureIndex: number | null) {
    if (!plan) return;
    const next = { ...answers, [ruleId]: true };
    setAnswers(next);
    const postureId = postureIndex !== null ? plan.posture_ids[postureIndex] : null;
    if (postureId) setPostureFlags((f) => [...f, { rule_id: ruleId, posture_id: postureId }]);
    const flags = evaluateRedFlags({ answers: next, painBefore }, plan.settings);
    const w = worst(flags);
    if (w && stopsSession(w.level)) {
      const skipped = plan.posture_ids.slice(results.length).map((id) => ({ posture_id: id, method: "skipped" as const, units_done: 0, units_target: getPosture(id).detector.units, seconds_held: 0 }));
      return finish({ answers: next, results: [...results, ...skipped] });
    }
    if (postureIndex !== null) skipPosture(postureIndex, next);
  }

  function skipPosture(i: number, a = answers) {
    if (!plan) return;
    const id = plan.posture_ids[i];
    const r: PostureResult = { posture_id: id, method: "skipped", units_done: 0, units_target: getPosture(id).detector.units, seconds_held: 0 };
    next(i, [...results, r], a);
  }

  function next(i: number, res: PostureResult[], a = answers) {
    setResults(res);
    setAnswers(a);
    if (!plan) return;
    if (i + 1 < plan.posture_ids.length) setStage(beforePosture(i + 1));
    else setStage({ s: "pain_after" });
  }

  function beforePosture(i: number): Stage {
    const id = plan!.posture_ids[i];
    if (rulesAskedAt("before_posture", id).length) return { s: "ask_before_posture", i };
    if (getPosture(id).position === "standing") speak(CUES.chair_nearby);
    return { s: "posture", i };
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
            <li>แอปนี้ไม่ใช่การวินิจฉัยหรือรักษา ท่าทั้งหมดมาจากแผ่นของกรมฯ ตามที่แพทย์แผนไทยสั่ง</li>
            <li>ผู้ป่วยอายุต่ำกว่า 18 ปี ให้ผู้ปกครองเป็นผู้กดยินยอม</li>
          </ul>
          <button
            className="btn w-full text-xl"
            onClick={async () => {
              const r = await api<{ consent_at: string }>(`/api/p/${code}/consent`, { body: { secret } });
              if (r.ok) {
                setPlan({ ...plan, consent_at: r.data.consent_at });
                setStage({ s: "home" });
              }
            }}
          >
            ยินยอมและเริ่มใช้งาน
          </button>
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
          <button
            className="btn w-full text-2xl py-5"
            onClick={() => {
              unlockAudio();
              setAnswers({});
              setResults([]);
              setPostureFlags([]);
              setStage({ s: "pre" });
            }}
          >
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
              onClick={async () => {
                if (!confirm("ลบข้อมูลทั้งหมดของแผนนี้และหยุดใช้งาน?")) return;
                const r = await api(`/api/p/${code}/delete`, { body: { secret } });
                if (r.ok) {
                  await forgetPlan(code);
                  setStage({ s: "error", msg: "ลบข้อมูลของคุณแล้ว แผนนี้หยุดใช้งาน" });
                }
              }}
            >
              ลบข้อมูลของฉัน
            </button>
          </details>
        </section>
      )}

      {stage.s === "pre" && (
        <section className="space-y-3">
          <h1 className="text-xl font-bold">ก่อนเริ่ม ตอบคำถามเรื่องอาการ</h1>
          <YesNoQuestions
            rules={rulesAskedAt("pre")}
            onDone={(a) => {
              setAnswers(a);
              const w = worst(evaluateRedFlags({ answers: a }, plan.settings));
              if (w && stopsSession(w.level)) return finish({ answers: a, results: [] });
              setStage({ s: "pain_before" });
            }}
          />
        </section>
      )}

      {stage.s === "pain_before" && (
        <PainScale
          title="ตอนนี้ปวดแค่ไหน (ก่อนทำท่า)"
          onDone={(v) => {
            setPainBefore(v);
            const w = worst(evaluateRedFlags({ answers, painBefore: v }, plan.settings));
            if (w && stopsSession(w.level)) return finish({ painBefore: v, results: [] });
            setStage(beforePosture(0));
          }}
        />
      )}

      {stage.s === "ask_before_posture" && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">ก่อนท่า{getPosture(plan.posture_ids[stage.i]).name_th.replace(/^ท่า/, "")}</h2>
          <YesNoQuestions
            rules={rulesAskedAt("before_posture", plan.posture_ids[stage.i])}
            onDone={(a) => {
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
          onDone={(r) => next(stage.i, [...results, r])}
          onButton={(b: DuringButton) => {
            if (b === "sharp_pain") raise("RF04", stage.i);
            else if (b === "unsteady") raise("RF11", stage.i);
            else setStage({ s: "dizzy_check", i: stage.i });
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

      {stage.s === "pain_after" && <PainScale title="หลังทำท่า ตอนนี้ปวดแค่ไหน" onDone={(v) => { setPainAfter(v); setStage({ s: "post" }); }} />}

      {stage.s === "post" && (
        <section className="space-y-3">
          <h1 className="text-xl font-bold">หลังทำท่า</h1>
          <YesNoQuestions rules={rulesAskedAt("post")} onDone={(a) => finish({ answers: a, painAfter })} />
        </section>
      )}

      {stage.s === "result" && (
        <section className="space-y-3">
          {stage.flags.length === 0 && <p className="card text-xl">✅ {CUES.session_done}</p>}
          {worst(stage.flags) && <FlagMessage flag={worst(stage.flags)!} clinicPhone={plan.clinic.phone} />}
          {stage.flags.slice(1).map((f) => (
            <FlagMessage key={f.rule_id} flag={f} clinicPhone={plan.clinic.phone} />
          ))}
          {stage.queued && <p className="text-orange-700">ยังส่งผลไม่ได้ (ไม่มีอินเทอร์เน็ต) แอปจะส่งให้อัตโนมัติเมื่อเปิดลิงก์อีกครั้ง</p>}
          {stage.saveFailed && <p className="text-orange-700">ยังส่งผลไม่ได้ และเก็บผลไว้ในมือถือไม่สำเร็จ โปรดแจ้งคลินิกเมื่อพบกันครั้งหน้า</p>}
          <button className="btn-ghost w-full" onClick={() => setStage({ s: "home" })}>
            กลับหน้าแรก
          </button>
        </section>
      )}
    </main>
  );

}
