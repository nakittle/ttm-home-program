"use client";
import type { LucideIcon } from "lucide-react";
import { thaiDate } from "@/lib/client";

/** "5 ต.ค." (no year) for axis labels and tight spots. */
export const shortDate = (day: string) => thaiDate(day).replace(/ \d{4}$/, "");

/** YYYY-MM-DD plus n days (UTC, so no DST surprises). */
export function plusDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** "29 ก.ย. – 5 ต.ค." for a week that starts on `day`. */
export const weekRange = (day: string) => `${shortDate(day)} – ${shortDate(plusDays(day, 6))}`;

/** Difference of two shares in percentage points, rounded; null when either side is missing. */
export function pointsDelta(now: number | null | undefined, before: number | null | undefined): number | null {
  if (now === null || now === undefined || before === null || before === undefined) return null;
  return Math.round(now * 100) - Math.round(before * 100);
}

/** Card heading: icon in a soft tile, title, optional one-line help. */
export function CardHead({ icon: Icon, title, help, id, children }: { icon: LucideIcon; title: string; help?: React.ReactNode; id?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden className="mt-0.5 hidden h-10 w-10 shrink-0 items-center sm:flex justify-center rounded-2xl bg-brand-tint text-brand">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-xl leading-[1.35] font-semibold">
            {title}
          </h2>
          {help && <p className="text-base text-muted">{help}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/** A row of toggle buttons (one pressed at a time). Wraps on narrow screens instead of scrolling. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  grid = false,
}: {
  label: string;
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Four or more options: a tidy 2-column grid on phones instead of a ragged wrap. */
  grid?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`gap-1 rounded-[28px] border border-line bg-background p-1 ${grid ? "grid grid-cols-2 sm:inline-flex sm:flex-wrap sm:self-start" : "inline-flex max-w-full flex-wrap self-start"}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-base font-semibold whitespace-nowrap transition-colors duration-200 ${
              on ? "bg-brand text-white shadow-btn" : "text-brand hover:bg-brand-tint"
            }`}
          >
            {Icon && <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
