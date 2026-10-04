import type { RedFlagLevel } from "@/lib/content/schema";

export const LEVEL_TH: Record<RedFlagLevel, { label: string; icon: string; cls: string }> = {
  call_1669: { label: "โทร 1669", icon: "🔴", cls: "bg-red-100 text-red-800 border-red-300" },
  stop_and_contact_clinic: { label: "หยุดและติดต่อคลินิก", icon: "🟠", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  pause_posture: { label: "พักท่านี้", icon: "🟡", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  note_for_next_visit: { label: "บันทึกไว้", icon: "⚪", cls: "bg-stone-100 text-stone-700 border-stone-300" },
};

export function LevelBadge({ level }: { level: RedFlagLevel }) {
  const l = LEVEL_TH[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm ${l.cls}`}>
      {l.icon} {l.label}
    </span>
  );
}
