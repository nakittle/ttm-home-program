"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Info, Lock, RotateCcw, Save } from "lucide-react";
import { api, enterOpenClinic } from "@/lib/client";
import { redflags } from "@/lib/content";
import type { ClinicRuleSettings } from "@/lib/redflags";
import { LevelBadge } from "@/components/LevelBadge";
import { ClinicShell } from "@/components/clinic/Shell";

const STRENGTH_TH = { stated: "เอกสารเขียนไว้", derived: "อนุมานจากเอกสาร", team: "ข้อเสนอของทีม" } as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<ClinicRuleSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<{ unauthorized: boolean; message: string } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  // Text typed in each threshold box; settings only ever holds a valid 1-10 value.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  /** Every edit goes through here so the "saved" tick and an old error never outlive the change. */
  const change = (next: ClinicRuleSettings) => {
    setSettings(next);
    setSaved(false);
    setSaveErr(null);
  };
  const isValid = (t: string) => /^\d+$/.test(t) && Number(t) >= 1 && Number(t) <= 10;

  const load = useCallback(async () => {
    setLoadErr(null);
    const get = () => api<{ clinic: { settings: ClinicRuleSettings } }>("/api/clinic/dashboard");
    let r = await get();
    if (r.status === 401 && (await enterOpenClinic())) r = await get();
    if (r.ok) setSettings(r.data.clinic.settings);
    else if (r.status === 401) window.location.href = "/clinic";
    else setLoadErr(r.message_th ?? "โหลดไม่ได้ ลองใหม่อีกครั้ง");
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const hasBad = Object.values(drafts).some((t) => !isValid(t));
  if (!settings && loadErr)
    return (
      <ClinicShell>
        <div role="alert" className="card mx-auto flex max-w-lg flex-col items-center gap-4 p-8 text-center">
          <p className="font-semibold text-foreground">{loadErr}</p>
          <button className="btn" onClick={load}>
            <RotateCcw aria-hidden className="h-5 w-5" strokeWidth={2} />
            ลองอีกครั้ง
          </button>
        </div>
      </ClinicShell>
    );
  if (!settings) return <main className="flex flex-1 items-center justify-center px-5 py-12 text-xl text-muted">กำลังโหลด…</main>;
  return (
    <ClinicShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rise">
          <h1 className="font-display text-[36px] font-bold leading-tight text-brand">
            กฎ<span className="text-clay-ink">ธงแดง</span>
          </h1>
          <p className="text-base text-muted">เปิด/ปิดกฎและปรับเกณฑ์ปวดของคลินิกนี้ กฎด้านความปลอดภัยปิดไม่ได้</p>
        </div>
        <p className="rise flex gap-3 rounded-3xl border border-gold bg-gold-tint p-4 text-base shadow-soft">
          <Info aria-hidden className="mt-1 h-5 w-5 shrink-0" strokeWidth={2} />
          {redflags.label_th}
        </p>
        <ul className="space-y-3">
          {redflags.rules.map((r, n) => {
            const off = settings.disabled.includes(r.id);
            return (
              <li key={r.id} className={`card rise space-y-2 transition ${off ? "opacity-60" : ""}`} style={{ ["--i" as string]: Math.min(n, 8) }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-sage-tint px-2 py-0.5 text-base font-bold text-brand">{r.id}</span>
                  <LevelBadge level={r.level} />
                  <span className="text-base text-muted">หลักฐาน: {STRENGTH_TH[r.strength]}</span>
                  {r.clinic_adjustable ? (
                    <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-3 text-base font-semibold">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={!off}
                        onChange={() =>
                          change({ ...settings, disabled: off ? settings.disabled.filter((x) => x !== r.id) : [...settings.disabled, r.id] })
                        }
                      />
                      <span
                        aria-hidden
                        className="relative h-7 w-12 rounded-full bg-line transition peer-checked:bg-brand peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-clay-ink after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-surface after:shadow after:transition peer-checked:after:translate-x-5"
                      />
                      ใช้กฎนี้
                    </label>
                  ) : (
                    <span className="ml-auto inline-flex items-center gap-1.5 text-base text-muted">
                      <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
                      ปิดไม่ได้ (ความปลอดภัย)
                    </span>
                  )}
                </div>
                <p className="text-lg">{r.question_th}</p>
                {r.trigger.type === "pain_delta_gte" && (
                  <label className="flex flex-wrap items-center gap-2 text-base font-semibold">
                    เกณฑ์ปวดเพิ่ม ≥
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="input w-20 px-3 py-1.5 text-center font-normal"
                      value={drafts[r.id] ?? String(settings.thresholds[r.id] ?? r.trigger.value)}
                      onChange={(e) => {
                        const t = e.target.value;
                        setDrafts((d) => ({ ...d, [r.id]: t }));
                        setSaved(false);
                        setSaveErr(null);
                        // An empty or out-of-range box keeps the last good value in settings; save stays disabled meanwhile.
                        if (isValid(t)) change({ ...settings, thresholds: { ...settings.thresholds, [r.id]: Number(t) } });
                      }}
                    />
                    ระดับ
                    {drafts[r.id] !== undefined && !isValid(drafts[r.id]) && <span className="text-emergency">ใส่เลข 1–10</span>}
                  </label>
                )}
                <p className="flex gap-1.5 text-base text-muted">
                  <BookOpen aria-hidden className="mt-1 h-4 w-4 shrink-0" strokeWidth={2} />
                  ที่มา: {r.source_th}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-4 shadow-soft">
          <div className="text-base">
            {hasBad && <p className="font-semibold text-emergency">เกณฑ์ปวดต้องเป็นเลข 1–10 จึงจะบันทึกได้</p>}
            {saveErr && (
              <p role="alert" className="font-semibold text-emergency">
                {saveErr.message}
                {saveErr.unauthorized && (
                  <>
                    {" "}
                    <Link href="/clinic" className="underline">
                      เข้าสู่ระบบ
                    </Link>
                  </>
                )}
              </p>
            )}
            {saved && <p className="font-semibold text-brand">บันทึกแล้ว</p>}
            {!hasBad && !saveErr && !saved && <p className="text-muted">การเปลี่ยนแปลงมีผลกับแผนทุกแผนของคลินิกนี้</p>}
          </div>
          <button
            className="btn min-h-14 px-7 text-lg"
            disabled={saving || hasBad}
            onClick={async () => {
              setSaving(true);
              setSaved(false);
              setSaveErr(null);
              const r = await api("/api/clinic/settings", { method: "PUT", body: settings });
              setSaving(false);
              if (r.ok) setSaved(true);
              else if (r.status === 401) setSaveErr({ unauthorized: true, message: "โปรดเข้าสู่ระบบใหม่" });
              else setSaveErr({ unauthorized: false, message: r.message_th ?? "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
            }}
          >
            <Save aria-hidden className="h-5 w-5" strokeWidth={2} />
            บันทึก
          </button>
        </div>
      </div>
    </ClinicShell>
  );
}
