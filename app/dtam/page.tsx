"use client";
import { useCallback, useEffect, useState } from "react";
import { Building2, ChartColumn, Database, EyeOff, LogIn, RotateCcw, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import type { DtamSummary } from "@/lib/aggregate";
import { api, pct, thaiDate } from "@/lib/client";
import { getGroup } from "@/lib/content";
import type { RedFlagLevel } from "@/lib/content/schema";
import { LevelBadge } from "@/components/LevelBadge";
import { GrowBar } from "@/components/patient/Progress";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-6 pb-2">
        <LogoMark className="h-11 w-11" />
        <span className="leading-tight">
          <span className="block text-lg font-bold text-brand">การบ้านหลังนวด · ภาพรวมกรมฯ</span>
          <span className="block text-base text-muted">กรมการแพทย์แผนไทยและการแพทย์ทางเลือก</span>
        </span>
      </header>
      <main className="mx-auto max-w-6xl px-5 pt-4 pb-12">{children}</main>
    </div>
  );
}

/** Stat tile: label, one value, optional note. */
function Stat({ label, value, note, i }: { label: string; value: string; note?: string; i: number }) {
  return (
    <div className="card rise space-y-1" style={{ ["--i" as string]: i }}>
      <p className="text-base text-muted">{label}</p>
      <p className="font-display text-[34px] font-bold leading-none text-brand">{value}</p>
      {note && <p className="text-base text-muted">{note}</p>}
    </div>
  );
}

/**
 * Weekly adherence: one series, so no legend; the title names it. Columns grow from one baseline,
 * 4px rounded tops, earlier weeks in a lighter sage and the latest week in forest. Only the latest value
 * is labelled; every other value is on hover/focus and in the table below.
 */
function WeeklyBars({ weeks }: { weeks: DtamSummary["weekly_adherence"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 180;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const last = weeks.length - 1;
  return (
    <div className="relative">
      <div className="flex gap-3">
        <div aria-hidden className="relative w-10 shrink-0 text-right text-base text-muted" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ top: H - t * H }}>
              {t * 100}%
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} aria-hidden className={`absolute inset-x-0 h-px ${t === 0 ? "bg-muted/40" : "bg-line"}`} style={{ top: H - t * H }} />
          ))}
          <ol className="absolute inset-0 flex items-end justify-around gap-2" aria-label="อัตราทำตามแผนรายสัปดาห์">
            {weeks.map((w, i) => {
              const v = w.adherence ?? 0;
              const on = hover === i;
              return (
                <li
                  key={w.week_start}
                  tabIndex={0}
                  aria-label={`สัปดาห์เริ่ม ${thaiDate(w.week_start)}: ${pct(w.adherence)}`}
                  className="group relative flex h-full flex-1 cursor-default items-end justify-center focus:outline-none"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                >
                  {i === last && w.adherence !== null && !on && (
                    <span className="absolute -translate-y-full pb-1.5 text-base font-semibold text-foreground tabular-nums" style={{ bottom: v * H }}>
                      {pct(w.adherence)}
                    </span>
                  )}
                  <span
                    className={`grow-up w-full max-w-6 rounded-t-[4px] transition-opacity ${i === last ? "bg-brand" : "bg-[#6f8f72]"} ${hover !== null && !on ? "opacity-50" : ""} group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-clay-ink`}
                    style={{ height: Math.max(v * H, w.adherence === null ? 0 : 2), ["--i" as string]: i }}
                  />
                  {on && (
                    <span className="absolute z-10 -translate-y-full rounded-2xl border border-line bg-surface px-3 py-2 text-base whitespace-nowrap shadow-soft" style={{ bottom: v * H + 8 }}>
                      <span className="block text-muted">สัปดาห์เริ่ม {thaiDate(w.week_start)}</span>
                      <span className="block font-semibold tabular-nums">ทำตามแผน {pct(w.adherence)}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div aria-hidden className="mt-2 flex gap-3">
        <span className="w-10 shrink-0" />
        <div className="flex flex-1 justify-around gap-2 text-base text-muted">
          {weeks.map((w, i) => (
            <span key={w.week_start} className={`flex-1 text-center ${i === last ? "font-semibold text-foreground" : ""}`}>
              {thaiDate(w.week_start).replace(/ \d{4}$/, "")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DtamPage() {
  const [data, setData] = useState<DtamSummary | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoadErr(null);
    const r = await api<DtamSummary>("/api/dtam/summary");
    if (r.status === 401) return setNeedLogin(true);
    if (r.ok) {
      setNeedLogin(false);
      setData(r.data);
    } else {
      setNeedLogin(false);
      setLoadErr(r.status === 429 ? "ขอข้อมูลถี่เกินไป รอสักครู่แล้วลองอีกครั้ง" : (r.message_th ?? "โหลดข้อมูลไม่สำเร็จ ลองอีกครั้ง"));
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (needLogin)
    return (
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <form
          className="card rise w-full max-w-sm space-y-5 p-7"
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            setErr(null);
            const r = await api("/api/dtam/login", { body: { password } });
            if (r.ok) await load();
            else setErr(r.message_th ?? "เข้าสู่ระบบไม่สำเร็จ");
            setSubmitting(false);
          }}
        >
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-tint text-brand">
              <ChartColumn className="h-7 w-7" strokeWidth={2} />
            </span>
            <div className="leading-tight">
              <p className="text-base text-muted">การบ้านหลังนวด</p>
              <h1 className="font-display text-[28px] font-bold text-brand">ภาพรวมสำหรับกรมฯ</h1>
            </div>
          </div>
          <label className="block space-y-1 font-semibold">
            รหัสผ่านเดโม
            <input className="input font-normal" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {err && <p className="font-semibold text-emergency">{err}</p>}
          <button className="btn w-full" disabled={submitting}>
            <LogIn aria-hidden className="h-5 w-5" strokeWidth={2} />
            {submitting ? "กำลังตรวจสอบ…" : "เข้าดู"}
          </button>
        </form>
      </main>
    );
  if (!data && loadErr)
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="font-semibold text-emergency">{loadErr}</p>
        <button className="btn" onClick={load}>
          <RotateCcw aria-hidden className="h-5 w-5" strokeWidth={2} />
          ลองอีกครั้ง
        </button>
      </main>
    );
  if (!data) return <main className="flex flex-1 items-center justify-center p-10 text-xl text-muted">กำลังโหลด…</main>;

  const levels: RedFlagLevel[] = ["call_1669", "stop_and_contact_clinic", "pause_posture", "note_for_next_visit"];
  const groups = [...new Set(data.flags_by_group.map((f) => f.group_id))];
  const demo = data.clinics.some((c) => c.is_demo);
  return (
    <Shell>
      <section className="rise flex flex-wrap items-end justify-between gap-4 pb-6">
        <div className="max-w-3xl">
          <h1 className="font-display text-[38px] font-bold leading-tight text-brand">
            ท่าฤๅษีดัดตนที่แจกไป <span className="text-clay-ink">มีคนทำจริงกี่ %</span>
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
              ตัวเลขรวมเท่านั้น ไม่มีข้อมูลรายคน
            </span>
            <span className="inline-flex items-center gap-1.5">
              <EyeOff aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
              ศูนย์ที่มีผู้ป่วยน้อยกว่า 5 คนจะไม่แสดงตัวเลข
            </span>
            <span>ณ {thaiDate(data.generated_on)}</span>
          </p>
        </div>
        {demo && (
          <span className="inline-flex items-center gap-2 rounded-full border border-gold bg-gold-tint px-4 py-1.5 text-base font-semibold">
            <Database aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
            ข้อมูลจำลอง
          </span>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat i={0} label="แผนที่ออก" value={String(data.totals.plans)} />
        <Stat i={1} label="ผู้ป่วยที่ยังทำอยู่" value={String(data.totals.active_patients)} note="ภายใน 14 วัน" />
        <Stat i={2} label="ทำตามแผน" value={pct(data.totals.adherence)} />
        <Stat i={3} label="มาครบคอร์ส" value={pct(data.totals.completion_rate)} />
        <Stat i={4} label="นับด้วยกล้อง" value={pct(data.totals.camera_share)} />
      </div>

      <section className="card rise mt-5 space-y-4 p-6" style={{ ["--i" as string]: 5 }}>
        <div>
          <h2 className="text-xl font-semibold">อัตราทำตามแผนรายสัปดาห์</h2>
          <p className="text-base text-muted">8 สัปดาห์ล่าสุด · แท่งเข้ม = สัปดาห์นี้ · ชี้หรือแตะแท่งเพื่อดูตัวเลข</p>
        </div>
        <WeeklyBars weeks={data.weekly_adherence} />
      </section>

      <div className="mt-5 grid gap-5">
        <section className="card rise space-y-3 overflow-x-auto p-6" style={{ ["--i" as string]: 6 }}>
          <h2 className="text-xl font-semibold">ธงแดงตามกลุ่มอาการ</h2>
          <table className="w-full text-left text-base">
            <thead>
              <tr className="text-muted">
                <th className="py-2 pr-3 font-semibold">กลุ่ม</th>
                {levels.map((l) => (
                  <th key={l} className="px-2 py-2 text-right font-semibold">
                    <LevelBadge level={l} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g} className="border-t border-line">
                  <td className="py-3 pr-3 font-semibold">{getGroup(g).name_th}</td>
                  {levels.map((l) => {
                    const n = data.flags_by_group.find((f) => f.group_id === g && f.level === l)?.count ?? 0;
                    return (
                      <td key={l} className={`px-2 py-3 text-right text-lg tabular-nums ${n === 0 ? "text-muted" : "font-semibold"}`}>
                        {n}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card rise space-y-3 overflow-x-auto p-6" style={{ ["--i" as string]: 7 }}>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Building2 aria-hidden className="h-5 w-5 text-brand" strokeWidth={2} />
            เทียบรายศูนย์
          </h2>
          <table className="w-full text-left text-base">
            <thead>
              <tr className="text-muted">
                <th className="py-2 pr-3 font-semibold">ศูนย์</th>
                <th className="px-2 py-2 text-right font-semibold">แผน</th>
                <th className="px-2 py-2 text-right font-semibold">ยังทำอยู่</th>
                <th className="px-2 py-2 font-semibold">ทำตามแผน</th>
                <th className="px-2 py-2 text-right font-semibold">ครบคอร์ส</th>
                <th className="px-2 py-2 text-right font-semibold">กล้อง</th>
              </tr>
            </thead>
            <tbody>
              {data.clinics.map((c) => (
                <tr key={c.clinic_code} className="border-t border-line">
                  <td className="py-3 pr-3 font-semibold">{c.clinic_name}</td>
                  {c.hidden ? (
                    <td colSpan={5} className="px-2 py-3 text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <EyeOff aria-hidden className="h-4 w-4" strokeWidth={2} />
                        น้อยกว่า 5 ราย (ไม่แสดง)
                      </span>
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-3 text-right tabular-nums">{c.plans}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{c.active_patients}</td>
                      <td className="px-2 py-3">
                        <span className="flex items-center gap-2">
                          <GrowBar value={c.adherence ?? 0} max={1} className="w-16" />
                          <span className="font-semibold tabular-nums">{pct(c.adherence)}</span>
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">{pct(c.completion_rate)}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{pct(c.camera_share)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <p className="mt-6 text-base text-muted">ขั้นต่อไป (เฟส 2): ส่งออกข้อมูลตามมาตรฐาน HDC / 43 แฟ้ม เพื่อรวมกับระบบรายงานของกระทรวง</p>
    </Shell>
  );
}
