"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CircleAlert, Database, EyeOff, Landmark, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { DtamSummary } from "@/lib/aggregate";
import { MIN_CELL } from "@/lib/aggregate";
import { api, thaiDate } from "@/lib/client";
import { KpiTiles } from "@/components/dtam/KpiTiles";
import { WeeklyTrend } from "@/components/dtam/WeeklyTrend";
import { ClinicRanking, ClinicTable } from "@/components/dtam/Clinics";
import { RedFlags } from "@/components/dtam/RedFlags";

const timeTh = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} น.`;

function TopBar({ demo, busy, onReload }: { demo: boolean; busy: boolean; onReload?: () => void }) {
  return (
    <header className="border-b border-line/80 bg-surface/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo sub="ภาพรวมสำหรับกรมฯ" />
        <div className="flex flex-wrap items-center gap-2">
          {demo && (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold bg-gold-tint px-4 text-base font-semibold">
              <Database aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
              ข้อมูลจำลอง
            </span>
          )}
          {onReload && (
            <button type="button" onClick={onReload} disabled={busy} className="btn-ghost min-h-12 px-4 text-base">
              <RefreshCw aria-hidden className={`h-[18px] w-[18px] ${busy ? "motion-safe:animate-spin" : ""}`} strokeWidth={2.25} />
              {busy ? "กำลังโหลด…" : "โหลดใหม่"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/** Placeholder blocks in the final layout, so nothing jumps when the numbers arrive. */
function Skeleton() {
  return (
    <div aria-hidden className="space-y-5">
      <div className="h-24 w-2/3 motion-safe:animate-pulse rounded-3xl bg-sage-tint/70" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-44 motion-safe:animate-pulse rounded-3xl bg-sage-tint/60 ${i === 0 ? "col-span-2" : ""}`} />
        ))}
      </div>
      <div className="h-96 motion-safe:animate-pulse rounded-3xl bg-sage-tint/50" />
    </div>
  );
}

export default function DtamPage() {
  const [data, setData] = useState<DtamSummary | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    setBusy(true);
    const r = await api<DtamSummary>("/api/dtam/summary");
    setBusy(false);
    if (r.ok) {
      setData(r.data);
      setLoadedAt(new Date());
    } else {
      setLoadErr(r.status === 429 ? "ขอข้อมูลถี่เกินไป รอสักครู่แล้วลองอีกครั้ง" : (r.message_th ?? "โหลดข้อมูลไม่สำเร็จ ลองอีกครั้ง"));
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const demo = !!data?.clinics.some((c) => c.is_demo);
  const hiddenCount = data?.clinics.filter((c) => c.hidden).length ?? 0;

  return (
    <div className="flex-1">
      <TopBar demo={demo} busy={busy} onReload={data ? load : undefined} />
      <main className="mx-auto max-w-[1200px] px-4 pt-6 pb-14 sm:px-6 sm:pt-8">
        {!data && loadErr ? (
          <div role="alert" className="card mx-auto flex max-w-lg flex-col items-center gap-4 p-8 text-center">
            <p className="font-semibold text-foreground">{loadErr}</p>
            <button className="btn" onClick={load}>
              <RotateCcw aria-hidden className="h-5 w-5" strokeWidth={2} />
              ลองอีกครั้ง
            </button>
          </div>
        ) : !data ? (
          <>
            <p className="sr-only" role="status">
              กำลังโหลด…
            </p>
            <Skeleton />
          </>
        ) : (
          <div className={`transition-opacity duration-300 ${busy ? "opacity-60" : ""}`} aria-busy={busy}>
            {/* A failed reload keeps the old numbers on screen, so say they are not fresh. */}
            {loadErr && (
              <p role="alert" className="mb-5 flex items-start gap-2 rounded-2xl border border-gold bg-gold-tint px-4 py-3 text-base">
                <CircleAlert aria-hidden className="mt-1 h-5 w-5 shrink-0" strokeWidth={2} />
                <span>
                  <span className="font-semibold">{loadErr}</span>
                  {loadedAt && <> · ตัวเลขด้านล่างเป็นข้อมูลที่โหลดเมื่อ {timeTh(loadedAt)}</>}
                </span>
              </p>
            )}
            <section className="rise flex flex-col gap-3 pb-6">
              <p className="inline-flex items-center gap-2 text-base font-semibold text-brand-2">
                <Landmark aria-hidden className="h-5 w-5" strokeWidth={2} />
                กรมการแพทย์แผนไทยและการแพทย์ทางเลือก
              </p>
              <h1 className="font-display text-[31px] leading-[1.3] font-bold text-brand sm:text-[39px]">
                ท่าฤๅษีดัดตนที่แจกไป <span className="text-clay-ink">มีคนทำจริงกี่ %</span>
              </h1>
              <ul className="flex flex-wrap gap-2 text-base text-muted">
                <li className="inline-flex flex-wrap items-center gap-x-2 rounded-full border border-line bg-surface px-3.5 py-1">
                  <CalendarDays aria-hidden className="h-[18px] w-[18px] text-brand-2" strokeWidth={2} />
                  <span className="whitespace-nowrap">ข้อมูล ณ {thaiDate(data.generated_on)}</span>
                  {loadedAt && <span className="whitespace-nowrap">· โหลดเมื่อ {timeTh(loadedAt)}</span>}
                </li>
                <li className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1">
                  <ShieldCheck aria-hidden className="h-[18px] w-[18px] text-brand-2" strokeWidth={2} />
                  ตัวเลขรวมเท่านั้น ไม่มีข้อมูลรายคน
                </li>
                <li className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1">
                  <EyeOff aria-hidden className="h-[18px] w-[18px] text-brand-2" strokeWidth={2} />
                  {hiddenCount > 0 ? `ซ่อน ${hiddenCount} ศูนย์ที่มีน้อยกว่า ${MIN_CELL} แผน` : `ศูนย์ที่มีน้อยกว่า ${MIN_CELL} แผนจะถูกซ่อน`}
                </li>
              </ul>
            </section>

            <KpiTiles data={data} />

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <WeeklyTrend weeks={data.weekly_adherence} average={data.totals.adherence} anyHidden={hiddenCount > 0} />
              </div>
              <div className="lg:col-span-5">
                <ClinicRanking data={data} focus={focus} onFocus={setFocus} />
              </div>
              <div className="lg:col-span-12">
                <RedFlags flags={data.flags_by_group} levels={data.flags_by_level} />
              </div>
              <div className="lg:col-span-12">
                <ClinicTable data={data} focus={focus} onFocus={setFocus} />
              </div>
            </div>

            <footer className="mt-8 grid gap-3 border-t border-line pt-6 text-base text-muted sm:grid-cols-2">
              <p className="flex items-start gap-2">
                <ShieldCheck aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brand-2" strokeWidth={2} />
                <span>
                  หน้านี้แสดงเฉพาะตัวเลขรวม ไม่มีชื่อหรือข้อมูลรายคน ศูนย์ที่มีน้อยกว่า {MIN_CELL} แผนจะไม่แสดงตัวเลข เพื่อไม่ให้ย้อนกลับไปหาตัวผู้ป่วยได้
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Landmark aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brand-2" strokeWidth={2} />
                <span>
                  ท่าฤๅษีดัดตนและเอกสารประกอบจากกรมการแพทย์แผนไทยและการแพทย์ทางเลือก · ขั้นต่อไป (เฟส 2): ส่งออกข้อมูลตามมาตรฐาน HDC / 43 แฟ้ม
                  เพื่อรวมกับระบบรายงานของกระทรวง
                </span>
              </p>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}
