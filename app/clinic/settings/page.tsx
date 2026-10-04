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

  useEffect(() => {
    api<{ clinic: { settings: ClinicRuleSettings } }>("/api/clinic/dashboard").then((r) => {
      if (r.ok) setSettings(r.data.clinic.settings);
      else if (r.status === 401) window.location.href = "/clinic";
    });
  }, []);

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
                        setSettings({ ...settings, disabled: off ? settings.disabled.filter((x) => x !== r.id) : [...settings.disabled, r.id] })
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
                    value={settings.thresholds[r.id] ?? r.trigger.value}
                    onChange={(e) => setSettings({ ...settings, thresholds: { ...settings.thresholds, [r.id]: Number(e.target.value) } })}
                  />{" "}
                  ระดับ
                </label>
              )}
              <p className="text-xs text-stone-500">ที่มา: {r.source_th}</p>
            </li>
          );
        })}
      </ul>
      <button
        className="btn w-full"
        onClick={async () => {
          const r = await api("/api/clinic/settings", { method: "PUT", body: settings });
          setSaved(r.ok);
        }}
      >
        บันทึก
      </button>
      {saved && <p className="text-green-700">บันทึกแล้ว</p>}
    </main>
  );
}
