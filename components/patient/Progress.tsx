import { Check, X } from "lucide-react";
import { addDaysLocal } from "@/lib/client";

const DAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAY_FULL_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** Sunday-start week (as on a Thai wall calendar) that contains `today` (YYYY-MM-DD). */
function weekOf(today: string): string[] {
  const dow = new Date(`${today}T12:00:00`).getDay();
  return Array.from({ length: 7 }, (_, i) => addDaysLocal(today, i - dow));
}

/** A rounded progress bar that grows in from the left. */
export function GrowBar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <span aria-hidden className={`relative block h-3.5 overflow-hidden rounded-full bg-sage-tint ${className}`}>
      {pct > 0 && <span className="grow-fill grow-in absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct * 100}%` }} />}
    </span>
  );
}

/**
 * This week at a glance: a bar of days done against the prescribed count, then seven day tiles.
 * Done = filled forest with a check, today = sun ring, stopped for safety = red cross (never counted),
 * the rest stay pale. Information, not a score: no streaks, no badges.
 */
export function WeekStrip({
  doneDays,
  today,
  daysPerWeek,
  stoppedToday = false,
}: {
  doneDays: string[];
  today: string;
  daysPerWeek: number;
  stoppedToday?: boolean;
}) {
  const days = weekOf(today);
  const done = new Set(doneDays);
  const isDoneDay = (d: string) => done.has(d) && !(stoppedToday && d === today);
  const doneThisWeek = days.filter(isDoneDay).length;
  return (
    <section aria-labelledby="week-heading" className="card rise space-y-4" style={{ ["--i" as string]: 1 }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-heading" className="text-[22px] font-semibold leading-[1.35]">สัปดาห์นี้</h2>
        <p className="text-muted">
          ทำแล้ว <span className="font-semibold text-foreground">{doneThisWeek}</span> จาก {daysPerWeek} วัน
        </p>
      </div>
      <GrowBar value={doneThisWeek} max={daysPerWeek} />
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const isDone = isDoneDay(d);
          const isToday = d === today;
          const stopped = isToday && stoppedToday;
          const state = stopped ? "หยุดกลางคัน" : isDone ? "ทำแล้ว" : d > today ? "ยังไม่ถึง" : isToday ? "ยังไม่ได้ทำ" : "ไม่ได้ทำ";
          return (
            <li key={d} className="flex flex-col items-center gap-2">
              <span className="sr-only">{`วัน${DAY_FULL_TH[i]}${isToday ? " (วันนี้)" : ""} ${state}`}</span>
              <span
                aria-hidden
                className={`flex h-12 w-full items-center justify-center rounded-2xl ${
                  stopped
                    ? "border-2 border-emergency bg-emergency-tint text-emergency"
                    : isDone
                      ? "bg-brand text-white shadow-btn"
                      : d > today
                        ? "border-2 border-line bg-surface"
                        : "bg-sage-tint"
                } ${isToday ? "outline-[3px] outline-offset-2 outline-gold outline" : ""}`}
              >
                {stopped ? <X className="h-6 w-6" strokeWidth={3} /> : isDone ? <Check className="h-6 w-6" strokeWidth={3} /> : null}
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

/** The session as segments, one per posture: done ones fill in, skipped ones stay dashed, the current one has a sun ring. */
export function SessionBar({ threads, current }: { threads: Thread[]; current: number | null }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {threads.map((t, i) => (
        <span
          key={i}
          className={`relative h-3 flex-1 overflow-hidden rounded-full ${
            t === "skipped" ? "border-2 border-dashed border-sage bg-transparent" : "bg-sage-tint"
          } ${i === current ? "outline-2 outline-offset-2 outline-gold outline" : ""}`}
        >
          {t === "done" && <span className="grow-fill grow-in absolute inset-0 rounded-full" />}
        </span>
      ))}
    </div>
  );
}
