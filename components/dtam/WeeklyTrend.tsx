"use client";
import { useRef, useState } from "react";
import { CalendarDays, ChartColumn, Table2, TrendingDown, TrendingUp } from "lucide-react";
import type { DtamSummary } from "@/lib/aggregate";
import { pct } from "@/lib/client";
import { CardHead, Segmented, pointsDelta, shortDate, totalsLabel, weekRange } from "./ui";

type Week = DtamSummary["weekly_adherence"][number];
const H = 220;
const TICKS = [0, 0.25, 0.5, 0.75, 1];

function deltaText(d: number | null) {
  if (d === null) return null;
  return d > 0 ? `สูงกว่าสัปดาห์ก่อน ${d} จุด` : d < 0 ? `ต่ำกว่าสัปดาห์ก่อน ${Math.abs(d)} จุด` : "เท่ากับสัปดาห์ก่อน";
}

/**
 * Column chart, one series (no legend box: the title names it). One tab stop; arrow keys, Home and End move
 * between weeks and show the same tooltip as hover. The whole column slot is the hit target, not just the bar.
 * Earlier weeks are de-emphasised sage, the latest week forest; a clay line marks the all-plan average.
 */
function Bars({ weeks, prevOf, average }: { weeks: Week[]; prevOf: (i: number) => number | null; average: number | null }) {
  const last = weeks.length - 1;
  const [active, setActive] = useState(last);
  const [tip, setTip] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (j: number) => {
    const k = Math.max(0, Math.min(last, j));
    setActive(k);
    setTip(k);
    refs.current[k]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowUp: i + 1, ArrowDown: i - 1, Home: 0, End: last }[e.key];
    if (to === undefined) {
      if (e.key === "Escape") setTip(null);
      return;
    }
    e.preventDefault();
    move(to);
  };

  return (
    <div>
      <div className="flex gap-2 sm:gap-3">
        <div aria-hidden className="relative w-11 shrink-0 text-right text-base text-muted" style={{ height: H }}>
          {TICKS.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 leading-none tabular-nums" style={{ top: H - t * H }}>
              {t * 100}%
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: H }}>
          {TICKS.map((t) => (
            <span key={t} aria-hidden className={`absolute inset-x-0 h-px ${t === 0 ? "bg-muted/50" : "bg-line"}`} style={{ top: H - t * H }} />
          ))}
          {average !== null && (
            <span aria-hidden className="absolute inset-x-0 z-[1] h-0.5 rounded-full bg-clay-ink/80 transition-[top] duration-500" style={{ top: H - average * H - 1 }} />
          )}
          <ol role="list" aria-label="อัตราทำตามแผนรายสัปดาห์ ใช้ลูกศรซ้ายขวาเลื่อนดูทีละสัปดาห์" className="absolute inset-0 flex items-end">
            {weeks.map((w, i) => {
              const v = w.adherence ?? 0;
              const on = tip === i;
              const dim = tip !== null && !on;
              const align = i < weeks.length / 3 ? "left-0" : i >= (weeks.length * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2";
              const d = deltaText(pointsDelta(w.adherence, prevOf(i)));
              return (
                <li key={w.week_start} className="relative flex h-full flex-1 justify-center">
                  <button
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    type="button"
                    tabIndex={i === active ? 0 : -1}
                    aria-label={`สัปดาห์ ${weekRange(w.week_start)}: ทำตามแผน ${pct(w.adherence)}${d ? ` ${d}` : ""}`}
                    className="group flex h-full w-full cursor-default items-end justify-center px-1 focus:outline-none"
                    onPointerEnter={() => setTip(i)}
                    onPointerLeave={() => setTip(null)}
                    onFocus={() => {
                      setActive(i);
                      setTip(i);
                    }}
                    onBlur={() => setTip(null)}
                    // Open only: on a tap, enter and focus have already opened it, so a toggle would shut it at once.
                    onClick={() => setTip(i)}
                    onKeyDown={(e) => onKey(e, i)}
                  >
                    <span
                      className={`grow-up block w-full max-w-7 rounded-t-[4px] transition-[height,opacity,background-color] duration-500 ease-out ${
                        i === last ? "bg-brand" : on ? "bg-brand-2" : "bg-[#6f8f72]"
                      } ${dim ? "opacity-45" : ""} group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-clay-ink`}
                      style={{ height: Math.max(v * H, w.adherence === null ? 0 : 3), ["--i" as string]: i }}
                    />
                  </button>
                  {i === last && w.adherence !== null && !on && (
                    <span aria-hidden className="pointer-events-none absolute z-[2] rounded-md bg-surface/90 px-1 text-base leading-snug font-semibold text-foreground" style={{ bottom: v * H + 4 }}>
                      {pct(w.adherence)}
                    </span>
                  )}
                  {on && (
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute z-10 w-max max-w-[240px] rounded-2xl border border-line bg-surface px-3 py-2.5 sm:px-4 text-base leading-snug shadow-soft ${align}`}
                      style={{ bottom: Math.min(v * H + 12, H - 84) }}
                    >
                      <span className="block font-display text-[25px] leading-tight font-bold text-brand">{pct(w.adherence)}</span>
                      <span className="block text-muted">{weekRange(w.week_start)}</span>
                      {d && <span className="block font-semibold text-foreground">{d}</span>}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div aria-hidden className="mt-2 flex gap-2 sm:gap-3">
        <span className="w-11 shrink-0" />
        <div className="flex min-w-0 flex-1 text-base text-muted">
          {weeks.map((w, i) => (
            <span
              key={w.week_start}
              className={`flex min-w-0 flex-1 basis-0 justify-center leading-snug whitespace-nowrap ${i === last ? "font-semibold text-foreground" : ""} ${weeks.length > 5 && (last - i) % 2 === 1 ? "max-sm:invisible" : ""}`}
            >
              {i === last ? "สัปดาห์นี้" : shortDate(w.week_start)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type Range = "4" | "8";
type View = "chart" | "table";

export function WeeklyTrend({ weeks, average, anyHidden = false }: { weeks: Week[]; average: number | null; anyHidden?: boolean }) {
  const [range, setRange] = useState<Range>("8");
  const [view, setView] = useState<View>("chart");
  const n = Number(range);
  const offset = Math.max(0, weeks.length - n);
  const shown = weeks.slice(offset);
  const prevOf = (i: number) => weeks[offset + i - 1]?.adherence ?? null;

  const valid = shown.filter((w) => w.adherence !== null) as { week_start: string; adherence: number }[];
  const best = valid.reduce<(typeof valid)[number] | null>((a, b) => (a && a.adherence >= b.adherence ? a : b), null);
  const latest = shown[shown.length - 1];
  const first = valid[0];
  const change = latest && first ? pointsDelta(latest.adherence, first.adherence) : null;

  return (
    <section aria-labelledby="trend-h" className="card rise flex h-full flex-col gap-5 p-5 sm:p-6" style={{ ["--i" as string]: 5 }}>
      <CardHead id="trend-h" icon={TrendingUp} title="อัตราทำตามแผนรายสัปดาห์" help={`${totalsLabel(anyHidden)} · แตะหรือชี้ที่แท่งเพื่อดูตัวเลข`} />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Range>
          label="ช่วงเวลา"
          value={range}
          onChange={setRange}
          options={[
            { value: "4", label: "4 สัปดาห์", icon: CalendarDays },
            { value: "8", label: "8 สัปดาห์" },
          ]}
        />
        <Segmented<View>
          label="รูปแบบ"
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "กราฟ", icon: ChartColumn },
            { value: "table", label: "ตาราง", icon: Table2 },
          ]}
        />
      </div>

      {/* Plain-language reading of the chart, so nobody has to decode it. */}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-2 sm:block sm:py-3">
          <dt className="text-base leading-snug text-muted">สัปดาห์นี้</dt>
          <dd className="text-xl font-semibold">{pct(latest?.adherence)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-2 sm:block sm:py-3">
          <dt className="text-base leading-snug text-muted">สูงสุดในช่วงนี้</dt>
          <dd className="text-xl font-semibold">
            {pct(best?.adherence)}
            <span className="ml-2 text-base font-normal text-muted">{best ? shortDate(best.week_start) : ""}</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-2 sm:block sm:py-3">
          <dt className="text-base leading-snug text-muted">เทียบต้นช่วง</dt>
          <dd className="flex items-center gap-1.5 text-xl font-semibold whitespace-nowrap">
            {change !== null && change < 0 && <TrendingDown aria-hidden className="h-5 w-5 text-clay-ink" strokeWidth={2.25} />}
            {change === null ? "–" : change > 0 ? `+${change} จุด` : change < 0 ? `−${Math.abs(change)} จุด` : "เท่าเดิม"}
          </dd>
        </div>
      </dl>

      {view === "chart" ? (
        <>
          <Bars key={range} weeks={shown} prevOf={prevOf} average={average} />
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-base text-muted">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="h-3.5 w-3.5 rounded-[4px] bg-brand" />
              สัปดาห์นี้
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="h-3.5 w-3.5 rounded-[4px] bg-[#6f8f72]" />
              สัปดาห์ก่อน ๆ
            </span>
            {average !== null && (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-6 rounded-full bg-clay-ink" />
                เฉลี่ยทุกแผน {pct(average)}
              </span>
            )}
          </p>
        </>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-left text-base whitespace-nowrap">
            <caption className="sr-only">อัตราทำตามแผนรายสัปดาห์</caption>
            <thead className="bg-background text-muted">
              <tr>
                <th scope="col" className="px-3 py-3 sm:px-4 font-semibold">สัปดาห์</th>
                <th scope="col" className="px-3 py-3 sm:px-4 text-right font-semibold">ทำตามแผน</th>
                <th scope="col" className="px-3 py-3 sm:px-4 text-right font-semibold">เทียบสัปดาห์ก่อน</th>
              </tr>
            </thead>
            <tbody>
              {[...shown].reverse().map((w, ri) => {
                const i = shown.length - 1 - ri;
                const d = pointsDelta(w.adherence, prevOf(i));
                return (
                  <tr key={w.week_start} className="border-t border-line">
                    <th scope="row" className="px-3 py-2.5 sm:px-4 font-normal whitespace-nowrap">
                      {weekRange(w.week_start)}
                    </th>
                    <td className="px-3 py-2.5 sm:px-4 text-right font-semibold tabular-nums">{pct(w.adherence)}</td>
                    <td className={`px-3 py-2.5 sm:px-4 text-right tabular-nums ${d !== null && d < 0 ? "font-semibold text-foreground" : "text-muted"}`}>
                      {d === null ? "–" : d > 0 ? `+${d} จุด` : d < 0 ? `−${Math.abs(d)} จุด` : "0"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
