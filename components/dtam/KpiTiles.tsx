"use client";
import type { LucideIcon } from "lucide-react";
import { Camera, CircleCheckBig, ClipboardList, Minus, Target, TrendingDown, TrendingUp, Users } from "lucide-react";
import type { DtamSummary } from "@/lib/aggregate";
import { pct } from "@/lib/client";
import { GrowBar } from "@/components/patient/Progress";
import { pointsDelta, shortDate } from "./ui";

/**
 * 8-week line in the de-emphasis sage with a 10% wash; latest point in forest with a surface ring.
 * The SVG stretches to the tile, so the end dot is an HTML circle (it would turn oval inside the SVG).
 * Decorative: the same numbers are in the weekly chart and its table.
 */
function Sparkline({ values }: { values: (number | null)[] }) {
  const W = 300;
  const H = 80;
  const pad = 8;
  // Scaled to the data's own range (a sparkline shows shape; the axis-true view is the weekly chart below).
  const real = values.filter((v): v is number => v !== null);
  const lo = Math.max(0, Math.min(...real) - 0.05);
  const hi = Math.min(1, Math.max(...real) + 0.05);
  const span = Math.max(0.01, hi - lo);
  const pts = values
    .map((v, i) => (v === null ? null : { x: (i * W) / Math.max(1, values.length - 1), y: pad + (1 - (v - lo) / span) * (H - pad * 2) }))
    .filter((p): p is { x: number; y: number } => p !== null);
  if (pts.length < 2) return null;
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const area = `M${pts[0].x},${H} L${line.replaceAll(" ", " L")} L${last.x},${H} Z`;
  return (
    <div aria-hidden className="relative h-20 w-full lg:h-28">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
        <path d={area} fill="var(--brand-2)" opacity="0.1" />
        <polyline points={line} fill="none" stroke="#6f8f72" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span
        className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand"
        style={{ left: `${(last.x / W) * 100}%`, top: `${(last.y / H) * 100}%` }}
      />
    </div>
  );
}

/** Signed change in percentage points with an arrow; down is the worrying direction, so it gets a clay arrow (not emergency red); the words stay in ink. */
function Delta({ points, vs }: { points: number | null; vs: string }) {
  if (points === null) return null;
  const Icon = points > 0 ? TrendingUp : points < 0 ? TrendingDown : Minus;
  const word = points > 0 ? `สูงขึ้น ${points} จุด` : points < 0 ? `ลดลง ${Math.abs(points)} จุด` : "เท่าเดิม";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-base font-semibold ${points < 0 ? "bg-clay-tint" : "bg-brand-tint"} text-foreground`}>
      <Icon aria-hidden className={`h-[18px] w-[18px] ${points < 0 ? "text-clay-ink" : "text-brand"}`} strokeWidth={2.25} />
      {word}
      <span className="font-normal">{vs}</span>
    </span>
  );
}

function Tile({ icon: Icon, label, value, note, meter, i }: { icon: LucideIcon; label: string; value: string; note?: React.ReactNode; meter?: number | null; i: number }) {
  return (
    <div className="card rise flex flex-col gap-2 p-5" style={{ ["--i" as string]: i }}>
      <p className="flex items-start gap-2 text-base leading-snug font-semibold text-muted max-sm:min-h-[2.75em]">
        <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-2" strokeWidth={2} />
        {label}
      </p>
      <p className="font-display text-[39px] leading-[1.15] font-bold text-brand">{value}</p>
      <div className="mt-auto space-y-2">
        {meter !== undefined && <GrowBar value={meter ?? 0} max={1} />}
        {note && <p className="text-base leading-snug text-muted">{note}</p>}
      </div>
    </div>
  );
}

export function KpiTiles({ data }: { data: DtamSummary }) {
  const w = data.weekly_adherence;
  const latest = w[w.length - 1]?.adherence ?? null;
  const prev = w[w.length - 2]?.adherence ?? null;
  const t = data.totals;
  const shown = data.clinics.filter((c) => !c.hidden).length;
  return (
    <section aria-label="ตัวเลขสำคัญ" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* Hero: the one number the page leads with, with its 8-week trend. */}
      <div
        className="card rise col-span-2 flex flex-col gap-4 bg-gradient-to-br from-surface via-surface to-brand-tint p-6 lg:row-span-2"
        style={{ ["--i" as string]: 0 }}
      >
        <p className="flex items-center gap-2 text-base font-semibold text-muted">
          <Target aria-hidden className="h-5 w-5 text-brand-2" strokeWidth={2} />
          ทำตามแผน (เฉลี่ยทุกแผน)
        </p>
        <p className="font-display text-[56px] leading-[1.1] font-bold text-brand sm:text-[64px]">{pct(t.adherence)}</p>
        <div className="mt-auto">
          <Sparkline values={w.map((x) => x.adherence)} />
          {/* The week-on-week change sits with this week's number, not the all-time one above. */}
          <p className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-base text-muted">
            <span>{w[0] ? shortDate(w[0].week_start) : ""}</span>
            <span className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
              <span>
                สัปดาห์นี้ <span className="font-semibold text-foreground">{pct(latest)}</span>
              </span>
              <Delta points={pointsDelta(latest, prev)} vs="จากสัปดาห์ก่อน" />
            </span>
          </p>
        </div>
      </div>
      <Tile i={1} icon={ClipboardList} label="แผนที่ออก" value={String(t.plans)} note={shown < data.clinics.length ? `รวมเฉพาะ ${shown} ศูนย์ที่แสดง` : `จาก ${data.clinics.length} ศูนย์`} />
      <Tile i={2} icon={Users} label="ผู้ป่วยที่ยังทำอยู่" value={String(t.active_patients)} note="ทำภายใน 14 วันล่าสุด" />
      <Tile i={3} icon={CircleCheckBig} label="มาครบคอร์ส" value={pct(t.completion_rate)} meter={t.completion_rate} note="ของแผนที่ปิดแล้ว" />
      <Tile i={4} icon={Camera} label="นับด้วยกล้อง" value={pct(t.camera_share)} meter={t.camera_share} note="ของท่าที่ทำทั้งหมด" />
    </section>
  );
}
