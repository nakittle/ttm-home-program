"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Volume2, X } from "lucide-react";
import { speak } from "@/lib/audio";
import type { RedFlagRule } from "@/lib/content/schema";
import { stopsSession, type Answers } from "@/lib/redflags";

/** Back + Next row shared by the question screens. Next is the big one; Back is always there when there is somewhere to go. */
function StepNav({ onBack, onNext, nextDisabled, nextLabel = "ถัดไป" }: { onBack?: () => void; onNext: () => void; nextDisabled: boolean; nextLabel?: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 pt-2">
      {onBack ? (
        <button className="btn-ghost min-h-16 px-4 text-xl" onClick={onBack}>
          <ChevronLeft aria-hidden className="h-7 w-7" strokeWidth={2} />
          ย้อนกลับ
        </button>
      ) : (
        <span />
      )}
      <button className="btn min-h-16 text-[22px]" disabled={nextDisabled} onClick={onNext}>
        {nextLabel}
        <ChevronRight aria-hidden className="h-7 w-7" strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Symptom questions, one per screen, each with a listen button. `onBack` is called from the first question;
 * `onIndex` reports "question i of n" so the page header can show where the patient is.
 * A "yes" to a rule that stops the session ends the questions there: the page goes straight to the stop / 1669 screen.
 */
export function YesNoQuestions({
  rules,
  onDone,
  onBack,
  onIndex,
}: {
  rules: RedFlagRule[];
  onDone: (a: Answers) => void;
  onBack?: () => void;
  onIndex?: (i: number, n: number) => void;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [i, setI] = useState(0);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  // After Next/Back, move focus to the new question so a screen reader reads it (not on first show).
  useEffect(() => {
    if (moved.current) questionRef.current?.focus();
    moved.current = true;
  }, [i]);
  useEffect(() => {
    onIndex?.(i, rules.length);
  }, [i, rules.length, onIndex]);
  const r = rules[i];
  if (!r) return null;
  const answer = answers[r.id];
  const last = i === rules.length - 1;
  const stop = answer === true && stopsSession(r.level);
  const set = (v: boolean) => setAnswers((a) => ({ ...a, [r.id]: v }));
  return (
    <div className="space-y-5">
      <h1 key={r.id} ref={questionRef} tabIndex={-1} className="text-[24px] font-semibold leading-[1.6] focus:outline-none">
        {r.question_th}
      </h1>
      <button className="btn-ghost w-full border-indigo/70 text-xl text-indigo active:bg-indigo-tint" onClick={() => speak(r.question_th)}>
        <Volume2 aria-hidden className="h-7 w-7" strokeWidth={2} />
        ฟังคำถาม
      </button>
      <div className="grid grid-cols-2 gap-3" role="group" aria-label="คำตอบ">
        <button
          aria-pressed={answer === true}
          className={`flex min-h-20 items-center justify-center gap-2 rounded-3xl border-2 text-[25px] font-semibold transition ${
            answer === true ? "border-emergency bg-emergency text-white shadow-btn" : "border-emergency/50 bg-surface text-emergency shadow-soft"
          }`}
          onClick={() => set(true)}
        >
          <Check aria-hidden className="h-8 w-8" strokeWidth={2.5} />
          ใช่
        </button>
        <button
          aria-pressed={answer === false}
          className={`flex min-h-20 items-center justify-center gap-2 rounded-3xl border-2 text-[25px] font-semibold transition ${
            answer === false ? "border-brand bg-brand text-white shadow-btn" : "border-brand/50 bg-surface text-brand shadow-soft"
          }`}
          onClick={() => set(false)}
        >
          <X aria-hidden className="h-8 w-8" strokeWidth={2.5} />
          ไม่ใช่
        </button>
      </div>
      <StepNav
        onBack={i > 0 ? () => setI(i - 1) : onBack}
        nextDisabled={answer === undefined}
        onNext={() => (stop || last ? onDone(answers) : setI(i + 1))}
      />
    </div>
  );
}

const PAIN_WORD: Record<number, string> = { 0: "ไม่ปวดเลย", 5: "ปวดปานกลาง", 10: "ปวดมากที่สุด" };

/** 0–10 pain scale with big numbers; the chosen number stays filled. */
export function PainScale({ title, onDone, onBack }: { title: string; onDone: (v: number) => void; onBack?: () => void }) {
  const [v, setV] = useState<number | null>(null);
  // Tint deepens with the number: calm green, pale gold, deeper gold. Red stays reserved for stopping and 1669.
  const tone = (n: number) => (n <= 3 ? "bg-brand-tint" : n <= 6 ? "bg-gold-tint" : "bg-gold/55");
  return (
    <div className="space-y-5">
      <h1 className="font-display text-[31px] font-semibold leading-[1.35]">{title}</h1>
      <p className="text-muted">0 = ไม่ปวดเลย · 10 = ปวดมากที่สุด</p>
      <div className="grid grid-cols-4 gap-3" role="group" aria-label="ระดับปวด">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            aria-pressed={v === n}
            aria-label={PAIN_WORD[n] ? `${n} ${PAIN_WORD[n]}` : String(n)}
            className={`flex min-h-20 items-center justify-center rounded-3xl border-2 font-display transition text-[34px] font-bold leading-none ${
              v === n ? "border-brand bg-brand text-white shadow-btn" : `border-transparent text-foreground ${tone(n)}`
            }`}
            onClick={() => setV(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <StepNav onBack={onBack} nextDisabled={v === null} onNext={() => v !== null && onDone(v)} />
    </div>
  );
}
