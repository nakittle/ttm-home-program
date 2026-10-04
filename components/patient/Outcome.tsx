"use client";
import { useEffect } from "react";
import { CircleAlert, CirclePause, NotebookPen, Phone, Siren } from "lucide-react";
import { speak } from "@/lib/audio";
import type { FiredFlag } from "@/lib/redflags";
import { ruleById } from "@/lib/redflags";

/**
 * Speak `text` once when mounted (and again only if the text changes). Mount it from the stage that
 * owns the message: effects run after the previous screen's cleanup (which stops audio), so the
 * message is not cut off.
 */
export function SpeakOnce({ text }: { text: string }) {
  useEffect(() => {
    speak(text);
  }, [text]);
  return null;
}

// The frame colour and the action carry the level; an inline mark starts the message (no label pill above it).
const MARK = { call_1669: Siren, stop_and_contact_clinic: CircleAlert, pause_posture: CirclePause, note_for_next_visit: NotebookPen } as const;
const MARK_COLOR = { call_1669: "text-emergency", stop_and_contact_clinic: "text-emergency", pause_posture: "text-foreground", note_for_next_visit: "text-muted" } as const;

const FRAME = {
  call_1669: "border-emergency bg-emergency-tint",
  stop_and_contact_clinic: "border-emergency bg-surface",
  pause_posture: "border-gold bg-gold-tint",
  note_for_next_visit: "border-line bg-surface",
} as const;

/** What the patient sees after a red flag (fixed text from redflags.json — never generated). Silent: the caller speaks. */
export function FlagMessage({ flag, clinicPhone }: { flag: FiredFlag; clinicPhone: string | null }) {
  const rule = ruleById(flag.rule_id);
  const emergency = flag.level === "call_1669";
  const Mark = MARK[flag.level];
  return (
    <div className={`rise space-y-4 rounded-3xl border-2 p-5 shadow-soft ${FRAME[flag.level]}`}>
      <p className={`flex gap-3 leading-[1.6] ${emergency ? "text-[25px] font-semibold" : "text-[22px]"}`}>
        <Mark aria-hidden className={`mt-1.5 h-8 w-8 shrink-0 ${MARK_COLOR[flag.level]}`} strokeWidth={2.25} />
        <span>{rule.patient_message_th}</span>
      </p>
      {emergency && (
        <a href="tel:1669" className="flex min-h-[76px] w-full items-center justify-center gap-3 rounded-full bg-emergency shadow-btn font-display text-[31px] font-bold text-white active:brightness-90">
          <Phone aria-hidden className="h-9 w-9" strokeWidth={2.25} />
          โทร 1669
        </a>
      )}
      {flag.level === "stop_and_contact_clinic" && clinicPhone && (
        <a href={`tel:${clinicPhone}`} className="btn min-h-16 w-full text-[22px]">
          <Phone aria-hidden className="h-7 w-7" strokeWidth={2} />
          <span className="text-center">
            โทรคลินิก <span className="whitespace-nowrap">{clinicPhone}</span>
          </span>
        </a>
      )}
    </div>
  );
}
