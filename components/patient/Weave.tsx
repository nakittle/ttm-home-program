import { Check } from "lucide-react";
import { addDaysLocal } from "@/lib/client";

const DAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAY_FULL_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** Sunday-start week (as on a Thai wall calendar) that contains `today` (YYYY-MM-DD). */
function weekOf(today: string): string[] {
  const dow = new Date(`${today}T12:00:00`).getDay();
  return Array.from({ length: 7 }, (_, i) => addDaysLocal(today, i - dow));
}

/** A red strike across a thread: this one was stopped. */
function Strike() {
  return <span aria-hidden className="absolute inset-x-0.5 top-1/2 h-[5px] -translate-y-1/2 -rotate-[20deg] rounded-full bg-emergency ring-2 ring-surface" />;
}

/**
 * This week as a strip of cloth: a day with homework done is woven, today is ringed in gold,
 * the rest are bare warp. Information, not a score: no streaks, no badges.
 * `weaveToday` plays the one authored moment (today's band weaving in) on the outcome screen;
 * `stoppedToday` strikes today's thread in red when the run was stopped for safety.
 */
export function WeekCloth({
  doneDays,
  today,
  daysPerWeek,
  weaveToday = false,
  stoppedToday = false,
}: {
  doneDays: string[];
  today: string;
  daysPerWeek: number;
  weaveToday?: boolean;
  stoppedToday?: boolean;
}) {
  const days = weekOf(today);
  const done = new Set(doneDays);
  // A day stopped for safety is struck, never counted or drawn as done.
  const isDoneDay = (d: string) => done.has(d) && !(stoppedToday && d === today);
  const doneThisWeek = days.filter(isDoneDay).length;
  return (
    <section aria-labelledby="week-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-heading" className="text-[25px] font-semibold leading-[1.35]">สัปดาห์นี้</h2>
        <p className="text-muted">
          ทำแล้ว <span className="font-semibold text-foreground">{doneThisWeek}</span> จาก {daysPerWeek} วัน
        </p>
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const isDone = isDoneDay(d);
          const isToday = d === today;
          const stopped = isToday && stoppedToday;
          const state = stopped ? "หยุดกลางคัน" : isDone ? "ทำแล้ว" : d > today ? "ยังไม่ถึง" : isToday ? "ยังไม่ได้ทำ" : "ไม่ได้ทำ";
          return (
            <li key={d} className="flex flex-col items-center gap-2.5">
              <span className="sr-only">{`วัน${DAY_FULL_TH[i]}${isToday ? " (วันนี้)" : ""} ${state}`}</span>
              <span
                aria-hidden
                className={`relative h-16 w-full rounded-xl border-2 ${
                  isDone ? "border-brand bg-brand-tint" : isToday ? "warp border-foreground" : "warp border-line"
                } ${isToday ? "outline-[3px] outline-offset-2 outline-gold outline" : ""}`}
              >
                {isDone && <span className={`weave absolute inset-0 rounded-[10px] ${isToday && weaveToday ? "weave-in" : ""}`} />}
                {isDone && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-brand bg-surface">
                    <Check className="h-4 w-4 text-brand" strokeWidth={3} />
                  </span>
                )}
                {stopped && <Strike />}
              </span>
              <span aria-hidden className={`text-lg leading-tight ${isToday ? "font-semibold text-foreground" : "text-muted"}`}>
                {isToday ? "วันนี้" : DAY_TH[i]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export type Thread = "done" | "skipped" | undefined;

/** The session as a warp of posture threads: done ones weave in, skipped ones stay bare, the current one is ringed in gold. */
export function SessionWarp({ threads, current }: { threads: Thread[]; current: number | null }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {threads.map((t, i) => (
        <span
          key={i}
          className={`relative h-3.5 flex-1 overflow-hidden rounded-full border-2 ${
            t === "done" ? "border-gold bg-brand-deep" : t === "skipped" ? "border-dashed border-white/70 bg-transparent" : "border-brand-tint/60 bg-brand-deep"
          } ${i === current ? "outline-2 outline-offset-1 outline-gold outline" : ""}`}
        >
          {t === "done" && <span className="weave weave-in absolute inset-0" />}
        </span>
      ))}
    </div>
  );
}
