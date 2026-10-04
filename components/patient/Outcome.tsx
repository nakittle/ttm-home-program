"use client";
import { useEffect } from "react";
import { speak } from "@/lib/audio";
import type { FiredFlag } from "@/lib/redflags";
import { ruleById } from "@/lib/redflags";
import { LevelBadge } from "@/components/LevelBadge";

/** What the patient sees after a red flag (fixed text from redflags.json — never generated). */
export function FlagMessage({ flag, clinicPhone }: { flag: FiredFlag; clinicPhone: string | null }) {
  const rule = ruleById(flag.rule_id);
  useEffect(() => {
    speak(rule.patient_message_th);
  }, [rule.patient_message_th]);
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
