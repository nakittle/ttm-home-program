"use client";
import { useState } from "react";
import { speak } from "@/lib/audio";
import type { RedFlagRule } from "@/lib/content/schema";
import type { Answers } from "@/lib/redflags";

/** Big yes/no buttons, one question per card, each with a "ฟัง" button. */
export function YesNoQuestions({ rules, onDone }: { rules: RedFlagRule[]; onDone: (a: Answers) => void }) {
  const [answers, setAnswers] = useState<Answers>({});
  const complete = rules.every((r) => answers[r.id] !== undefined);
  return (
    <div className="space-y-3">
      {rules.map((r) => (
        <div key={r.id} className="card space-y-2">
          <p className="text-lg">{r.question_th}</p>
          <div className="flex gap-2">
            <button aria-pressed={answers[r.id] === true} className={`btn-ghost flex-1 text-xl ${answers[r.id] === true ? "bg-red-100 border-2 border-red-500" : ""}`} onClick={() => setAnswers((a) => ({ ...a, [r.id]: true }))}>
              {answers[r.id] === true && "✓ "}ใช่
            </button>
            <button aria-pressed={answers[r.id] === false} className={`btn-ghost flex-1 text-xl ${answers[r.id] === false ? "bg-green-100 border-2 border-green-500" : ""}`} onClick={() => setAnswers((a) => ({ ...a, [r.id]: false }))}>
              {answers[r.id] === false && "✓ "}ไม่ใช่
            </button>
            <button className="btn-ghost" aria-label="ฟังคำถาม" onClick={() => speak(r.question_th)}>
              🔊
            </button>
          </div>
        </div>
      ))}
      <button className="btn w-full text-xl" disabled={!complete} onClick={() => onDone(answers)}>
        ถัดไป
      </button>
    </div>
  );
}

/** 0–10 pain scale with big buttons. */
export function PainScale({ title, onDone }: { title: string; onDone: (v: number) => void }) {
  const [v, setV] = useState<number | null>(null);
  const color = (n: number) => (n <= 3 ? "bg-green-100" : n <= 6 ? "bg-yellow-100" : "bg-red-100");
  return (
    <div className="card space-y-3">
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm text-stone-600">0 = ไม่ปวดเลย · 10 = ปวดมากที่สุด</p>
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} className={`rounded-xl border-2 py-3 text-xl font-bold ${color(n)} ${v === n ? "border-stone-900" : "border-transparent"}`} onClick={() => setV(n)}>
            {n}
          </button>
        ))}
      </div>
      <button className="btn w-full text-xl" disabled={v === null} onClick={() => v !== null && onDone(v)}>
        ถัดไป
      </button>
    </div>
  );
}
