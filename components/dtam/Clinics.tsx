"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  EyeOff,
  Trophy,
} from "lucide-react";
import type { ClinicSummary, DtamSummary } from "@/lib/aggregate";
import { MIN_CELL } from "@/lib/aggregate";
import { pct } from "@/lib/client";
import { GrowBar } from "@/components/patient/Progress";
import { CardHead, Segmented, totalsLabel } from "./ui";

export const HIDDEN_TH = "ข้อมูลน้อยเกินไป (ซ่อนเพื่อความเป็นส่วนตัว)";

function HiddenNote() {
  return (
    <span className="inline-flex items-center gap-2 text-base text-muted">
      <EyeOff
        aria-hidden
        className="h-[18px] w-[18px] shrink-0"
        strokeWidth={2}
      />
      {HIDDEN_TH}
    </span>
  );
}

type Metric = "adherence" | "completion_rate" | "camera_share" | "plans";
const METRIC: Record<Metric, { label: string; rate: boolean }> = {
  adherence: { label: "ทำตามแผน", rate: true },
  completion_rate: { label: "ครบคอร์ส", rate: true },
  camera_share: { label: "นับด้วยกล้อง", rate: true },
  plans: { label: "จำนวนแผน", rate: false },
};
const fmt = (m: Metric, v: number | null) =>
  METRIC[m].rate ? pct(v) : v === null ? "–" : String(v);

/**
 * Horizontal ranking of clinics on one chosen measure. One series, one colour; the clay tick is the all-clinic
 * value for rates. Hidden clinics sit at the bottom with a dashed empty track, never a zero bar.
 * Hovering a row (here or in the table) highlights the same clinic in both.
 */
export function ClinicRanking({
  data,
  focus,
  onFocus,
}: {
  data: DtamSummary;
  focus: string | null;
  onFocus: (code: string | null) => void;
}) {
  const [metric, setMetric] = useState<Metric>("adherence");
  const shown = data.clinics.filter((c) => !c.hidden);
  const hidden = data.clinics.filter((c) => c.hidden);
  const val = (c: ClinicSummary) => c[metric];
  const ranked = [...shown].sort((a, b) => (val(b) ?? -1) - (val(a) ?? -1));
  const rate = METRIC[metric].rate;
  const max = rate ? 1 : Math.max(1, ...shown.map((c) => c.plans ?? 0));
  const ref =
    metric === "plans"
      ? null
      : metric === "adherence"
        ? data.totals.adherence
        : metric === "completion_rate"
          ? data.totals.completion_rate
          : data.totals.camera_share;

  return (
    <section
      aria-labelledby="rank-h"
      className="card rise flex h-full flex-col gap-5 p-5 sm:p-6"
      style={{ ["--i" as string]: 6 }}
    >
      <CardHead
        id="rank-h"
        icon={Trophy}
        title="จัดอันดับศูนย์"
        help="เลือกตัวชี้วัด แล้วดูว่าศูนย์ไหนนำ"
      />
      <Segmented<Metric>
        label="ตัวชี้วัดที่ใช้จัดอันดับ"
        grid
        value={metric}
        onChange={setMetric}
        options={[
          { value: "adherence", label: "ทำตามแผน" },
          { value: "completion_rate", label: "ครบคอร์ส" },
          { value: "camera_share", label: "กล้อง" },
          { value: "plans", label: "แผน" },
        ]}
      />
      <ol
        className="flex flex-col gap-4"
        aria-label={`ศูนย์เรียงตาม${METRIC[metric].label} มากไปน้อย`}
      >
        {ranked.map((c, i) => {
          const v = val(c);
          const on = focus === c.clinic_code;
          return (
            <li
              key={c.clinic_code}
              tabIndex={0}
              aria-label={`อันดับ ${i + 1} ${c.clinic_name}: ${METRIC[metric].label} ${fmt(metric, v)}`}
              onPointerEnter={() => onFocus(c.clinic_code)}
              onPointerLeave={() => onFocus(null)}
              onFocus={() => onFocus(c.clinic_code)}
              onBlur={() => onFocus(null)}
              className={`-mx-2 rounded-2xl px-2 py-1.5 transition-colors duration-200 ${on ? "bg-brand-tint" : ""} ${focus && !on ? "opacity-60" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    aria-hidden
                    className={`w-6 shrink-0 text-center font-semibold ${i === 0 ? "text-brand" : "text-muted"}`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 font-semibold">{c.clinic_name}</span>
                </span>
                <span className="shrink-0 font-display text-[25px] leading-tight font-bold text-brand">
                  {fmt(metric, v)}
                </span>
              </div>
              <div
                aria-hidden
                className="relative mt-1.5 ml-8 h-4 rounded-full bg-sage-tint"
              >
                <span
                  className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-out ${on ? "bg-brand" : "bg-brand-2"}`}
                  style={{ width: `${Math.min(1, (v ?? 0) / max) * 100}%` }}
                />
                {ref !== null && (
                  <span
                    className="absolute -inset-y-1.5 w-[3px] rounded-full bg-clay-ink transition-[left] duration-500"
                    style={{ left: `calc(${ref * 100}% - 1.5px)` }}
                  />
                )}
              </div>
            </li>
          );
        })}
        {hidden.map((c) => (
          <li key={c.clinic_code} className="-mx-2 px-2 py-1.5">
            <div className="flex items-baseline gap-2">
              <span aria-hidden className="w-6 shrink-0 text-center text-muted">
                –
              </span>
              <span className="min-w-0 font-semibold text-muted">
                {c.clinic_name}
              </span>
            </div>
            <div className="mt-1 ml-8">
              <HiddenNote />
            </div>
          </li>
        ))}
      </ol>
      {ranked.length >= 2 &&
        val(ranked[0]) !== null &&
        val(ranked[ranked.length - 1]) !== null && (
          <p className="mt-auto rounded-2xl bg-background px-4 py-3 text-base text-muted">
            ศูนย์อันดับ 1 กับอันดับสุดท้ายห่างกัน{" "}
            <span className="font-semibold text-foreground">
              {rate
                ? `${Math.round((val(ranked[0]) ?? 0) * 100) - Math.round((val(ranked[ranked.length - 1]) ?? 0) * 100)} จุด`
                : `${(val(ranked[0]) ?? 0) - (val(ranked[ranked.length - 1]) ?? 0)} แผน`}
            </span>
          </p>
        )}
      {ref !== null && (
        <p className="flex items-center gap-2 text-base text-muted">
          <span aria-hidden className="h-5 w-[3px] rounded-full bg-clay-ink" />
          ขีดส้ม = {totalsLabel(hidden.length > 0)} {pct(ref)}
        </p>
      )}
    </section>
  );
}

type SortKey =
  | "clinic_name"
  | "plans"
  | "active_patients"
  | "adherence"
  | "completion_rate"
  | "camera_share";
const COLS: { key: SortKey; label: string; num: boolean }[] = [
  { key: "clinic_name", label: "ศูนย์", num: false },
  { key: "plans", label: "แผน", num: true },
  { key: "active_patients", label: "ยังทำอยู่", num: true },
  { key: "adherence", label: "ทำตามแผน", num: true },
  { key: "completion_rate", label: "ครบคอร์ส", num: true },
  { key: "camera_share", label: "กล้อง", num: true },
];

/** Every clinic, sortable by any column (click a header; click again to flip). Hidden clinics always stay last. */
export function ClinicTable({
  data,
  focus,
  onFocus,
}: {
  data: DtamSummary;
  focus: string | null;
  onFocus: (code: string | null) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "adherence",
    dir: "desc",
  });
  const shown = data.clinics.filter((c) => !c.hidden);
  const hidden = data.clinics.filter((c) => c.hidden);
  const sorted = [...shown].sort((a, b) => {
    const k = sort.key;
    const r =
      k === "clinic_name"
        ? a.clinic_name.localeCompare(b.clinic_name, "th")
        : (a[k] ?? -1) - (b[k] ?? -1);
    return sort.dir === "asc" ? r : -r;
  });
  const click = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "clinic_name" ? "asc" : "desc" },
    );

  return (
    <section
      aria-labelledby="table-h"
      className="card rise flex flex-col gap-4 p-5 sm:p-6"
      style={{ ["--i" as string]: 8 }}
    >
      <CardHead
        id="table-h"
        icon={Building2}
        title="เทียบรายศูนย์"
        help={`กดหัวตารางเพื่อเรียง · ศูนย์ที่มีน้อยกว่า ${MIN_CELL} แผนจะไม่แสดงตัวเลข`}
      />
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <table className="w-full min-w-[720px] text-left text-base">
          <caption className="sr-only">
            ตัวเลขรายศูนย์ เรียงตาม{COLS.find((c) => c.key === sort.key)?.label}
          </caption>
          <thead>
            <tr className="border-b-2 border-line text-muted">
              {COLS.map((c) => {
                const active = sort.key === c.key;
                const Icon = !active
                  ? ArrowUpDown
                  : sort.dir === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      active
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={`p-0 font-semibold ${c.num ? "text-right" : "sticky left-0 z-[1] bg-surface"}`}
                  >
                    <button
                      type="button"
                      onClick={() => click(c.key)}
                      className={`inline-flex min-h-12 w-full items-center gap-1.5 rounded-xl px-3 whitespace-nowrap transition-colors hover:bg-brand-tint ${c.num ? "justify-end" : ""} ${active ? "text-brand" : ""}`}
                    >
                      {c.label}
                      <Icon
                        aria-hidden
                        className={`h-4 w-4 shrink-0 ${active ? "" : "opacity-60"}`}
                        strokeWidth={2.25}
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const on = focus === c.clinic_code;
              return (
                <tr
                  key={c.clinic_code}
                  onPointerEnter={() => onFocus(c.clinic_code)}
                  onPointerLeave={() => onFocus(null)}
                  className={`border-t border-line transition-colors duration-200 ${on ? "bg-brand-tint" : ""}`}
                >
                  <th
                    scope="row"
                    className={`sticky left-0 z-[1] min-w-40 px-3 py-3 font-semibold transition-colors ${on ? "bg-brand-tint" : "bg-surface"}`}
                  >
                    {c.clinic_name}
                  </th>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {c.plans}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {c.active_patients}
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center justify-end gap-3">
                      <GrowBar
                        value={c.adherence ?? 0}
                        max={1}
                        className="w-20"
                      />
                      <span className="w-12 text-right font-semibold tabular-nums">
                        {pct(c.adherence)}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {pct(c.completion_rate)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {pct(c.camera_share)}
                  </td>
                </tr>
              );
            })}
            {hidden.map((c) => (
              <tr key={c.clinic_code} className="border-t border-line">
                <th
                  scope="row"
                  className="sticky left-0 z-[1] min-w-40 bg-background px-3 py-3 font-semibold text-muted"
                >
                  {c.clinic_name}
                </th>
                <td colSpan={5} className="bg-background px-3 py-3 text-right">
                  <HiddenNote />
                </td>
              </tr>
            ))}
          </tbody>
          {/* Totals leave hidden clinics out (lib/aggregate), so they can't be used to work one out. */}
          <tfoot>
            <tr className="border-t-2 border-line">
              <th
                scope="row"
                className="sticky left-0 z-[1] bg-surface px-3 py-3 font-semibold"
              >
                {totalsLabel(hidden.length > 0)}
              </th>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                {data.totals.plans}
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                {data.totals.active_patients}
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                {pct(data.totals.adherence)}
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                {pct(data.totals.completion_rate)}
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                {pct(data.totals.camera_share)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-base text-muted sm:hidden">
        เลื่อนตารางไปทางซ้ายเพื่อดูคอลัมน์อื่น
      </p>
    </section>
  );
}
