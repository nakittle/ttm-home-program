import { SEVERITY } from "@/lib/redflags";
import type { RedFlagLevel } from "@/lib/content/schema";
import type { ClinicRow, FlagRow, PlanRow, SessionRow } from "@/lib/db/types";

const DAY = 86_400_000;
const toDay = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const daysBetween = (a: string, b: string) => Math.round((toDay(b) - toDay(a)) / DAY);
export const addDays = (d: string, n: number) => new Date(toDay(d) + n * DAY).toISOString().slice(0, 10);
/** Bangkok calendar day of a timestamp (UTC+7 all year). */
const bangkokDay = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

/** A session counts as "done" when at least one posture was done (camera or button), not only skipped. */
const isDone = (s: SessionRow) => s.results.some((r) => r.method !== "skipped" && r.units_done > 0);

/** Closed with no consent on file: the patient deleted their data, so there is nothing left to measure. */
const withdrawn = (p: PlanRow) => p.status !== "active" && p.consent_at === null;

/** Share of expected sessions done in [from, to] (inclusive), capped at 1. null when nothing was expected yet. */
export function adherence(plan: PlanRow, sessions: SessionRow[], from: string, to: string): number | null {
  const start = from > plan.start_date ? from : plan.start_date;
  // A closed plan expects nothing after the day it was closed, even if that was before the visit date.
  const closedOn = plan.status !== "active" && plan.closed_at ? bangkokDay(plan.closed_at) : null;
  let end = to < plan.next_visit_date ? to : plan.next_visit_date;
  if (closedOn && closedOn < end) end = closedOn;
  const days = daysBetween(start, end) + 1;
  if (days <= 0) return null;
  const expected = (plan.days_per_week / 7) * days;
  if (expected < 0.5) return null;
  const doneDays = new Set(sessions.filter((s) => s.plan_id === plan.id && isDone(s) && s.performed_on >= start && s.performed_on <= end).map((s) => s.performed_on));
  return Math.min(1, doneDays.size / expected);
}

export interface DashboardItem {
  code: string;
  status: PlanRow["status"];
  group_ids: string[];
  start_date: string;
  next_visit_date: string;
  adherence_7d: number | null;
  adherence_all: number | null;
  last_session_on: string | null;
  days_since_last: number | null;
  pain: { on: string; before: number | null; after: number | null }[];
  open_flags: { id: string; rule_id: string; level: RedFlagLevel; posture_id: string | null; created_at: string }[];
  notes: { rule_id: string; created_at: string }[];
  camera_share: number | null;
  priority: 0 | 1 | 2 | 3 | 4;
  priority_reason: string;
}

/** Clinic dashboard rows, most urgent first. */
export function clinicDashboard(plans: PlanRow[], sessions: SessionRow[], flags: FlagRow[], today: string): DashboardItem[] {
  const items = plans.map((p): DashboardItem => {
    const ps = sessions.filter((s) => s.plan_id === p.id).sort((a, b) => a.performed_on.localeCompare(b.performed_on));
    const pf = flags.filter((f) => f.plan_id === p.id);
    const open = pf
      .filter((f) => !f.acknowledged_at && f.level !== "note_for_next_visit")
      .sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level]);
    const last = ps.length ? ps[ps.length - 1].performed_on : null;
    const sinceLast = last ? daysBetween(last, today) : p.start_date <= today ? daysBetween(p.start_date, today) : null;
    const results = ps.flatMap((s) => s.results).filter((r) => r.method !== "skipped");
    const camera = results.filter((r) => r.method === "camera").length;
    const daysToVisit = daysBetween(today, p.next_visit_date);

    let priority: DashboardItem["priority"] = 4;
    let reason = "ปกติ";
    if (p.status !== "active") {
      reason = p.status === "completed" ? "ครบคอร์สแล้ว" : "หยุดแผนแล้ว";
    } else if (open.some((f) => SEVERITY[f.level] >= 2)) {
      priority = 0;
      reason = "มีธงแดงที่ยังไม่รับทราบ";
    } else if (open.length) {
      priority = 1;
      reason = "มีท่าที่ผู้ป่วยต้องพัก";
    } else if (sinceLast !== null && sinceLast >= 3) {
      priority = 2;
      reason = `ไม่ได้ทำ ${sinceLast} วัน`;
    } else if (daysToVisit >= 0 && daysToVisit <= 2) {
      priority = 3;
      reason = "ใกล้วันนัด";
    }

    return {
      code: p.code,
      status: p.status,
      group_ids: p.group_ids,
      start_date: p.start_date,
      next_visit_date: p.next_visit_date,
      adherence_7d: adherence(p, ps, addDays(today, -6), today),
      adherence_all: adherence(p, ps, p.start_date, today),
      last_session_on: last,
      days_since_last: sinceLast,
      pain: ps.map((s) => ({ on: s.performed_on, before: s.pain_before, after: s.pain_after })),
      open_flags: open.map((f) => ({ id: f.id, rule_id: f.rule_id, level: f.level, posture_id: f.posture_id, created_at: f.created_at })),
      notes: pf.filter((f) => f.level === "note_for_next_visit").map((f) => ({ rule_id: f.rule_id, created_at: f.created_at })),
      camera_share: results.length ? camera / results.length : null,
      priority,
      priority_reason: reason,
    };
  });
  const active = (i: DashboardItem) => (i.status === "active" ? 0 : 1);
  return items.sort((a, b) => active(a) - active(b) || a.priority - b.priority || a.next_visit_date.localeCompare(b.next_visit_date));
}

export const MIN_CELL = 5; // hide counts from clinics with fewer patients than this

export interface ClinicSummary {
  clinic_code: string;
  clinic_name: string;
  is_demo: boolean;
  hidden: boolean; // fewer than MIN_CELL plans: numbers withheld
  plans: number | null;
  active_patients: number | null;
  adherence: number | null;
  completion_rate: number | null;
  camera_share: number | null;
}

export interface DtamSummary {
  generated_on: string;
  totals: { plans: number; active_patients: number; adherence: number | null; completion_rate: number | null; camera_share: number | null };
  weekly_adherence: { week_start: string; adherence: number | null }[];
  flags_by_group: { group_id: string; level: RedFlagLevel; count: number }[];
  flags_by_level: { level: RedFlagLevel; count: number }[]; // each flag once, however many groups its plan has
  clinics: ClinicSummary[];
}

function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function stats(plans: PlanRow[], sessions: SessionRow[], today: string) {
  const activeCut = addDays(today, -13);
  const active = plans.filter((p) => p.status === "active" && sessions.some((s) => s.plan_id === p.id && s.performed_on >= activeCut)).length;
  const closed = plans.filter((p) => p.status !== "active");
  const completion = closed.length ? closed.filter((p) => p.status === "completed").length / closed.length : null;
  const results = sessions.flatMap((s) => s.results).filter((r) => r.method !== "skipped");
  const camera = results.length ? results.filter((r) => r.method === "camera").length / results.length : null;
  const adh = mean(plans.filter((p) => !withdrawn(p)).map((p) => adherence(p, sessions, p.start_date, today)));
  return { plans: plans.length, active, completion, camera, adh };
}

/** DTAM view: aggregates only, no per-patient rows, small clinics masked. */
export function dtamSummary(clinics: ClinicRow[], plans: PlanRow[], sessions: SessionRow[], flags: FlagRow[], today: string, weeks = 8): DtamSummary {
  // Totals and the weekly series cover shown clinics only, so subtracting the shown rows reveals nothing about a hidden one.
  const shownIds = new Set(clinics.filter((c) => plans.filter((p) => p.clinic_id === c.id).length >= MIN_CELL).map((c) => c.id));
  const vis = plans.filter((p) => shownIds.has(p.clinic_id));
  const visIds = new Set(vis.map((p) => p.id));
  const visSessions = sessions.filter((s) => visIds.has(s.plan_id));
  const all = stats(vis, visSessions, today);
  const counted = vis.filter((p) => !withdrawn(p));
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(today, -7 * (weeks - i) + 1);
    const end = addDays(start, 6);
    return { week_start: start, adherence: mean(counted.map((p) => adherence(p, visSessions, start, end))) };
  });
  // Flags stay national (safety signals); they are never split per clinic, so they can't be subtracted.
  const planGroups = new Map(plans.map((p) => [p.id, p.group_ids]));
  const counts = new Map<string, number>();
  const levelCounts = new Map<RedFlagLevel, number>();
  for (const f of flags) {
    const groups = planGroups.get(f.plan_id);
    if (!groups) continue;
    levelCounts.set(f.level, (levelCounts.get(f.level) ?? 0) + 1);
    for (const g of groups) {
      const key = `${g}|${f.level}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const flagsByGroup = [...counts.entries()].map(([k, count]) => {
    const [group_id, level] = k.split("|");
    return { group_id, level: level as RedFlagLevel, count };
  });
  const flagsByLevel = [...levelCounts.entries()].map(([level, count]) => ({ level, count }));
  const perClinic = clinics.map((c): ClinicSummary => {
    const cp = plans.filter((p) => p.clinic_id === c.id);
    const ids = new Set(cp.map((p) => p.id));
    const s = stats(cp, sessions.filter((x) => ids.has(x.plan_id)), today);
    const hidden = cp.length < MIN_CELL;
    return {
      clinic_code: c.code,
      clinic_name: c.name,
      is_demo: c.is_demo,
      hidden,
      plans: hidden ? null : s.plans,
      active_patients: hidden ? null : s.active,
      adherence: hidden ? null : s.adh,
      completion_rate: hidden ? null : s.completion,
      camera_share: hidden ? null : s.camera,
    };
  });
  return {
    generated_on: today,
    totals: { plans: all.plans, active_patients: all.active, adherence: all.adh, completion_rate: all.completion, camera_share: all.camera },
    weekly_adherence: weekly,
    flags_by_group: flagsByGroup,
    flags_by_level: flagsByLevel,
    clinics: perClinic,
  };
}
