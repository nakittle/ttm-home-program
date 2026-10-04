import { CircleAlert, CirclePause, NotebookPen, Siren } from "lucide-react";
import type { RedFlagLevel } from "@/lib/content/schema";

// `icon` is the plain-text marker still used where only text fits (the DTAM summary table).
export const LEVEL_TH: Record<RedFlagLevel, { label: string; icon: string; cls: string }> = {
  call_1669: { label: "โทร 1669", icon: "🔴", cls: "bg-emergency text-white border-emergency" },
  stop_and_contact_clinic: { label: "หยุดและติดต่อคลินิก", icon: "🟠", cls: "bg-emergency-tint text-emergency border-emergency" },
  pause_posture: { label: "พักท่านี้", icon: "🟡", cls: "bg-gold-tint text-foreground border-gold" },
  note_for_next_visit: { label: "บันทึกไว้", icon: "⚪", cls: "bg-surface text-muted border-line" },
};

const LEVEL_ICON = { call_1669: Siren, stop_and_contact_clinic: CircleAlert, pause_posture: CirclePause, note_for_next_visit: NotebookPen } as const;

export function LevelBadge({ level }: { level: RedFlagLevel }) {
  const l = LEVEL_TH[level];
  const Icon = LEVEL_ICON[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-0.5 text-base font-semibold ${l.cls}`}>
      <Icon aria-hidden className="h-4.5 w-4.5" strokeWidth={2.25} />
      {l.label}
    </span>
  );
}
