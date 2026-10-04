"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { redflags } from "@/lib/content";
import type { ClinicRuleSettings } from "@/lib/redflags";
import { LevelBadge } from "@/components/LevelBadge";

const STRENGTH_TH = { stated: "เอกสารเขียนไว้", derived: "อนุมานจากเอกสาร", team: "ข้อเสนอของทีม" } as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<ClinicRuleSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<{ unauthorized: boolean; message: string } | null>(null);
  // Text typed in each threshold box; settings only ever holds a valid 1-10 value.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  /** Every edit goes through here so the "saved" tick and an old error never outlive the change. */
  const change = (next: ClinicRuleSettings) => {
    setSettings(next);
    setSaved(false);
    setSaveErr(null);
  };
  const isValid = (t: string) => /^\d+$/.test(t) && Number(t) >= 1 && Number(t) <= 10;

  useEffect(() => {
    api<{ clinic: { settings: ClinicRuleSettings } }>("/api/clinic/dashboard").then((r) => {
      if (r.ok) setSettings(r.data.clinic.settings);
      else if (r.status === 401) window.location.href = "/clinic";
    });
  }, []);

  const hasBad = Object.values(drafts).some((t) => !isValid(t));
  if (!settings) return <main className="px-4 py-10 text-center">กำลังโหลด…</main>;
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      <Link href="/clinic" className="text-stone-600">
        ← กลับ
      </Link>
      <h1 className="text-2xl font-bold">กฎธงแดง</h1>
      <p className="text-sm bg-yellow-50 border border-yellow-300 rounded-xl p-3">{redflags.label_th}</p>
      <ul className="space-y-2">
        {redflags.rules.map((r) => {
          const off = settings.disabled.includes(r.id);
          return (
            <li key={r.id} className="card space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{r.id}</span>
                <LevelBadge level={r.level} />
                <span className="text-xs text-stone-500">หลักฐาน: {STRENGTH_TH[r.strength]}</span>
                {r.clinic_adjustable ? (
                  <label className="ml-auto flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!off}
                      onChange={() =>
                        change({ ...settings, disabled: off ? settings.disabled.filter((x) => x !== r.id) : [...settings.disabled, r.id] })
                      }
                    />
                    ใช้กฎนี้
                  </label>
                ) : (
                  <span className="ml-auto text-xs text-stone-500">ปิดไม่ได้ (ความปลอดภัย)</span>
                )}
              </div>
              <p>{r.question_th}</p>
              {r.trigger.type === "pain_delta_gte" && (
                <label className="text-sm">
                  เกณฑ์ปวดเพิ่ม ≥{" "}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="w-16 rounded border px-2"
                    value={drafts[r.id] ?? String(settings.thresholds[r.id] ?? r.trigger.value)}
                    onChange={(e) => {
                      const t = e.target.value;
                      setDrafts((d) => ({ ...d, [r.id]: t }));
                      setSaved(false);
                      setSaveErr(null);
                      // An empty or out-of-range box keeps the last good value in settings; save stays disabled meanwhile.
                      if (isValid(t)) change({ ...settings, thresholds: { ...settings.thresholds, [r.id]: Number(t) } });
                    }}
                  />{" "}
                  ระดับ
                  {drafts[r.id] !== undefined && !isValid(drafts[r.id]) && <span className="ml-2 text-red-700">ใส่เลข 1–10</span>}
                </label>
              )}
              <p className="text-xs text-stone-500">ที่มา: {r.source_th}</p>
            </li>
          );
        })}
      </ul>
      <button
        className="btn w-full"
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
        บันทึก
      </button>
      {hasBad && <p className="text-red-700">เกณฑ์ปวดต้องเป็นเลข 1–10 จึงจะบันทึกได้</p>}
      {saveErr && (
        <p role="alert" className="text-red-700">
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
      {saved && <p className="text-green-700">บันทึกแล้ว</p>}
    </main>
  );
}
