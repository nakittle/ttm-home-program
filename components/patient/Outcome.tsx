"use client";
import { useEffect } from "react";
import { speak } from "@/lib/audio";
import type { FiredFlag } from "@/lib/redflags";
import { ruleById } from "@/lib/redflags";
import { LevelBadge } from "@/components/LevelBadge";

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

/** What the patient sees after a red flag (fixed text from redflags.json — never generated). Silent: the caller speaks. */
export function FlagMessage({ flag, clinicPhone }: { flag: FiredFlag; clinicPhone: string | null }) {
  const rule = ruleById(flag.rule_id);
  const emergency = flag.level === "call_1669";
  return (
    <div className={`card space-y-3 border-2 ${emergency ? "border-red-600 bg-red-50" : "border-orange-400"}`}>
      <LevelBadge level={flag.level} />
      <p className="text-xl">{rule.patient_message_th}</p>
      {emergency && (
        <a href="tel:1669" className="btn w-full text-2xl bg-red-700">
          📞 โทร 1669
        </a>
      )}
      {flag.level === "stop_and_contact_clinic" && clinicPhone && (
        <a href={`tel:${clinicPhone}`} className="btn w-full text-xl">
          📞 โทรคลินิก {clinicPhone}
        </a>
      )}
    </div>
  );
}
