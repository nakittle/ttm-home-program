import { getPosture } from "@/lib/content";
import type { Posture } from "@/lib/content/schema";
import type { PostureResult } from "@/lib/pose/session";
import { evaluateRedFlags, ruleById, stopsSession, worst, type Answers, type ClinicRuleSettings, type FiredFlag } from "@/lib/redflags";

/**
 * Pure bookkeeping for one patient run (pre-check → postures → post-check). The page keeps a RunData
 * in a ref and passes it explicitly to every step, so nothing is read from a stale render.
 */

export interface PostureFlag {
  rule_id: string;
  posture_id: string;
}

export interface RunData {
  answers: Answers;
  painBefore: number | null;
  painAfter: number | null;
  results: PostureResult[];
  postureFlags: PostureFlag[];
  /** Set after RF11 (unsteady when standing): every later standing posture is skipped. */
  skipStanding: boolean;
}

/** "Unsteady when standing" — after this rule the rest of the standing postures are skipped. */
export const UNSTEADY_RULE = "RF11";

export function emptyRun(): RunData {
  return { answers: {}, painBefore: null, painAfter: null, results: [], postureFlags: [], skipStanding: false };
}

type PositionOf = (postureId: string) => Posture["position"];
const defaultPosition: PositionOf = (id) => getPosture(id).position;

export function skippedResult(postureId: string, unitsTarget = getPosture(postureId).detector.units): PostureResult {
  return { posture_id: postureId, method: "skipped", units_done: 0, units_target: unitsTarget, seconds_held: 0 };
}

/** Every planned posture without a result yet is recorded as skipped (plan order kept). */
export function withAllSkipped(postureIds: string[], results: PostureResult[]): PostureResult[] {
  const have = new Set(results.map((r) => r.posture_id));
  return [...results, ...postureIds.filter((id) => !have.has(id)).map((id) => skippedResult(id))];
}

/** Stop the whole run (pre-check, pain-before or mid-session): the rest of the plan is skipped. */
export function stopRun(run: RunData, postureIds: string[]): RunData {
  return { ...run, results: withAllSkipped(postureIds, run.results) };
}

export function flagsFor(run: RunData, settings: ClinicRuleSettings): FiredFlag[] {
  return evaluateRedFlags({ answers: run.answers, painBefore: run.painBefore, painAfter: run.painAfter }, settings);
}

/** Would the run stop now (a call_1669 or stop_and_contact_clinic rule fires)? */
export function stopsNow(run: RunData, settings: ClinicRuleSettings): boolean {
  const w = worst(flagsFor(run, settings));
  return w !== null && stopsSession(w.level);
}

/** Has the patient reported a symptom this run (a "yes" answer or a button during a posture)? Leaving then still sends it. */
export function reportedSymptom(run: RunData): boolean {
  return run.postureFlags.length > 0 || Object.values(run.answers).some(Boolean);
}

export type RaiseOutcome =
  | { kind: "stop"; run: RunData }
  | { kind: "pause"; run: RunData; ruleId: string }
  | { kind: "continue"; run: RunData };

/**
 * A red flag answered "yes" during posture `postureIndex`. Records the answer and the posture it
 * belongs to, then decides: stop the run (all remaining postures skipped), pause this posture
 * (show the rule's message, then go on), or continue.
 */
export function applyRaise(run: RunData, ruleId: string, postureIndex: number, postureIds: string[], settings: ClinicRuleSettings): RaiseOutcome {
  const postureId = postureIds[postureIndex];
  const next: RunData = {
    ...run,
    answers: { ...run.answers, [ruleId]: true },
    postureFlags: postureId ? [...run.postureFlags, { rule_id: ruleId, posture_id: postureId }] : run.postureFlags,
    skipStanding: run.skipStanding || ruleId === UNSTEADY_RULE,
  };
  if (stopsNow({ ...next, painAfter: null }, settings)) return { kind: "stop", run: stopRun(next, postureIds) };
  if (ruleById(ruleId).level === "pause_posture") return { kind: "pause", run: next, ruleId };
  return { kind: "continue", run: next };
}

/**
 * Record the result of posture `i` and find the next posture to present (null = no more postures).
 * After RF11 every standing posture on the way is recorded as skipped instead of presented.
 */
export function advance(run: RunData, postureIds: string[], i: number, result: PostureResult, positionOf: PositionOf = defaultPosition): { run: RunData; next: number | null } {
  const results = [...run.results, result];
  let j = i + 1;
  while (j < postureIds.length && run.skipStanding && positionOf(postureIds[j]) === "standing") {
    results.push(skippedResult(postureIds[j]));
    j++;
  }
  return { run: { ...run, results }, next: j < postureIds.length ? j : null };
}

/** The flag cards to show on the result screen: after a stop-level flag only that level is shown. */
export function visibleFlags(flags: FiredFlag[]): FiredFlag[] {
  const w = worst(flags);
  if (!w) return [];
  return stopsSession(w.level) ? flags.filter((f) => f.level === w.level) : flags;
}

/** 0 (offline), 429 and 5xx are worth retrying later; anything else will not succeed by retrying. */
export function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

export type SubmitOutcome = "sent" | "retry" | "rejected";

export function classifySubmit(ok: boolean, status: number): SubmitOutcome {
  if (ok) return "sent";
  return isRetryableStatus(status) ? "retry" : "rejected";
}

export interface SessionBody {
  [key: string]: unknown;
  client_id: string;
  performed_on: string;
  pain_before: number | null;
  pain_after: number | null;
  results: PostureResult[];
  answers: Answers;
  posture_flags: PostureFlag[];
}

export function sessionBody(run: RunData, clientId: string, performedOn: string): SessionBody {
  return {
    client_id: clientId,
    performed_on: performedOn,
    pain_before: run.painBefore,
    pain_after: run.painAfter,
    results: run.results,
    answers: run.answers,
    posture_flags: run.postureFlags,
  };
}
