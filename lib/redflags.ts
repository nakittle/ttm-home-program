import { redflags } from "@/lib/content";
import type { RedFlagLevel, RedFlagRule } from "@/lib/content/schema";

/** Rule id → patient answered "yes". */
export type Answers = Partial<Record<string, boolean>>;

export interface RedFlagInput {
  answers: Answers;
  painBefore?: number | null;
  painAfter?: number | null;
  postureId?: string | null; // posture on screen when a "during" button was pressed
}

/** Per-clinic changes; only rules with clinic_adjustable=true are affected. */
export interface ClinicRuleSettings {
  disabled: string[];
  thresholds: Record<string, number>;
}

export const DEFAULT_SETTINGS: ClinicRuleSettings = { disabled: [], thresholds: {} };

export interface FiredFlag {
  rule_id: string;
  level: RedFlagLevel;
  posture_id: string | null;
}

export const SEVERITY: Record<RedFlagLevel, number> = {
  call_1669: 3,
  stop_and_contact_clinic: 2,
  pause_posture: 1,
  note_for_next_visit: 0,
};

function fires(rule: RedFlagRule, input: RedFlagInput, settings: ClinicRuleSettings): boolean {
  const yes = input.answers[rule.id] === true;
  const before = input.painBefore ?? null;
  const after = input.painAfter ?? null;
  const delta = before !== null && after !== null ? after - before : null;
  const value = (rule.clinic_adjustable ? settings.thresholds[rule.id] : undefined) ?? ("value" in rule.trigger ? rule.trigger.value : 0);
  switch (rule.trigger.type) {
    case "yes":
      return yes;
    case "pain_gte":
      return Math.max(before ?? -1, after ?? -1) >= value;
    case "pain_delta_gte":
      return delta !== null && delta >= value;
    case "yes_and_pain_delta_lte":
      return yes && (delta === null || delta <= value);
  }
}

/** Evaluate every rule; deterministic, used on the phone and again on the server. */
export function evaluateRedFlags(input: RedFlagInput, settings: ClinicRuleSettings = DEFAULT_SETTINGS): FiredFlag[] {
  return redflags.rules
    .filter((r) => !(r.clinic_adjustable && settings.disabled.includes(r.id)))
    .filter((r) => fires(r, input, settings))
    .map((r) => ({ rule_id: r.id, level: r.level, posture_id: input.postureId ?? null }))
    .sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level]);
}

/** The response the patient sees: the most severe fired rule, or null. */
export function worst(flags: FiredFlag[]): FiredFlag | null {
  return flags.length ? flags[0] : null;
}

export function ruleById(id: string): RedFlagRule {
  const r = redflags.rules.find((x) => x.id === id);
  if (!r) throw new Error(`unknown rule ${id}`);
  return r;
}

/** Does this level stop the whole session (vs. only the current posture)? */
export function stopsSession(level: RedFlagLevel): boolean {
  return level === "call_1669" || level === "stop_and_contact_clinic";
}
