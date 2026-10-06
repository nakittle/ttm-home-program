import { activeGroups, getPosture, posturesForGroups } from "@/lib/content";
import { addDays, daysBetween } from "@/lib/aggregate";
import { hashPin } from "@/lib/auth";
import { hashSecret, newSecret } from "@/lib/plan";
import type { ClinicRow, NewFlag, Store } from "@/lib/db/types";
import type { PostureResult } from "@/lib/pose/session";

/** Small deterministic PRNG so the demo data is the same every time. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_CLINICS = [
  { code: "DEMO-A", name: "ศูนย์สาธิต ก (ข้อมูลจำลอง)", phone: "02-000-0001" },
  { code: "DEMO-B", name: "ศูนย์สาธิต ข (ข้อมูลจำลอง)", phone: "02-000-0002" },
  { code: "DEMO-C", name: "ศูนย์สาธิต ค (ข้อมูลจำลอง)", phone: "02-000-0003" },
];

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PLANS_PER_CLINIC = 20;

/** Code of seeded plan i of demo clinic ci. They all start with A, D or G, so never TCX-86 or another protected plan. */
const seedPlanCode = (ci: number, i: number) =>
  `${LETTERS[ci * 3]}${LETTERS[(i * 7) % 24]}${LETTERS[(i * 11 + ci) % 24]}-${2 + (i % 8)}${2 + ((i * 3 + ci) % 8)}`;

export const SEED_PLAN_CODES = DEMO_CLINICS.flatMap((_, ci) => Array.from({ length: PLANS_PER_CLINIC }, (_, i) => seedPlanCode(ci, i)));

/** Demo plans that people reach from printed QR codes (the Concept Paper): never closed or deleted by the demo tools. */
export const protectedPlanCodes = () => (process.env.PROTECTED_PLAN_CODES ?? "TCX-86").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

export class NoDemoPinError extends Error {}

/** The demo clinics; a missing one is created with the PIN. An existing clinic keeps its PIN and settings. */
async function demoClinics(store: Store, pin?: string) {
  const found = await Promise.all(DEMO_CLINICS.map((c) => store.getClinicByCode(c.code)));
  if (found.some((c) => !c) && !pin) throw new NoDemoPinError("DEMO_CLINIC_PIN is not set; it is needed to create the missing demo clinics");
  const out: ClinicRow[] = [];
  for (const [ci, c] of DEMO_CLINICS.entries()) {
    out.push(found[ci] ?? (await store.insertClinic({ ...c, pin_hash: hashPin(pin!), is_demo: true, settings: { disabled: [], thresholds: {} } })));
  }
  return out;
}

/** Fill the 3 demo clinics (created when missing) with ~60 plans over the last 8 weeks. Returns counts. */
export async function seedDemo(store: Store, today: string, pin?: string, seed = 42) {
  const clinics = await demoClinics(store, pin);
  const rnd = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const groups = activeGroups().map((g) => g.id);
  let plansMade = 0;
  let sessionsMade = 0;
  let flagsMade = 0;

  for (const [ci, clinic] of clinics.entries()) {
    for (let i = 0; i < PLANS_PER_CLINIC; i++) {
      const g1 = pick(groups);
      const groupIds = rnd() < 0.3 ? [...new Set([g1, pick(groups)])] : [g1];
      const start = addDays(today, -Math.floor(rnd() * 56));
      const length = 14 + Math.floor(rnd() * 15);
      const visit = addDays(start, length);
      const days = pick([3, 5, 7] as const);
      const code = seedPlanCode(ci, i);
      const ended = visit < today;
      const plan = await store.insertPlan({
        code,
        secret_hash: hashSecret(newSecret()),
        clinic_id: clinic.id,
        group_ids: groupIds,
        posture_ids: posturesForGroups(groupIds),
        days_per_week: days,
        remind_time: pick(["07:00", "12:00", "19:00", "20:00"]),
        start_date: start,
        next_visit_date: visit,
      });
      plansMade++;
      await store.updatePlan(plan.id, {
        consent_at: `${start}T03:00:00Z`,
        ...(ended ? { status: rnd() < 0.8 ? "completed" : "stopped", closed_at: `${visit}T09:00:00Z` } : {}),
      });

      // Adherence starts high and fades, like real home programmes.
      const p0 = 0.6 + rnd() * 0.35;
      const lastDay = ended ? visit : today;
      const lastStanding = [...plan.posture_ids].reverse().find((pid) => getPosture(pid).position === "standing") ?? null;
      let pain = 4 + Math.floor(rnd() * 4);
      for (let d = 0; d <= daysBetween(start, lastDay); d++) {
        const on = addDays(start, d);
        if (rnd() > (days / 7) * p0 * Math.exp(-d / 40)) continue;
        const before = Math.max(0, Math.min(10, pain + Math.round(rnd() * 2 - 1)));
        const after = Math.max(0, Math.min(10, before + Math.round(rnd() * 2 - 1.2)));
        if (rnd() < 0.15 && pain > 1) pain--;
        const results: PostureResult[] = plan.posture_ids.map((pid) => {
          const camera = rnd() < 0.7;
          return { posture_id: pid, method: camera ? "camera" : "button", units_done: 3, units_target: 3, seconds_held: camera ? 30 : 0 };
        });
        const answers: Record<string, boolean> = {};
        const flags: Omit<NewFlag, "session_id">[] = [];
        const r = rnd();
        if (r < 0.06) {
          answers.RF09 = true;
          flags.push({ plan_id: plan.id, rule_id: "RF09", level: "note_for_next_visit", posture_id: null });
        } else if (r < 0.075) {
          answers.RF04 = true;
          flags.push({ plan_id: plan.id, rule_id: "RF04", level: "stop_and_contact_clinic", posture_id: plan.posture_ids[0] });
        } else if (r < 0.09 && lastStanding) {
          // RF11 (unsteady) only makes sense on a standing posture; a plan without one never gets this flag.
          answers.RF11 = true;
          flags.push({ plan_id: plan.id, rule_id: "RF11", level: "pause_posture", posture_id: lastStanding });
        }
        const { row } = await store.insertSession({
          plan_id: plan.id, performed_on: on, pain_before: before, pain_after: after, results, answers, client_id: `seed-${code}-${d}`,
        });
        sessionsMade++;
        if (flags.length) {
          const inserted = await store.insertFlags(flags.map((f) => ({ ...f, session_id: row.id })));
          flagsMade += inserted.length;
          // Older flags were already seen by the clinic.
          for (const f of inserted) if (daysBetween(on, today) > 3) await store.acknowledgeFlag(f.id, clinic.id, `${on}T10:00:00Z`);
        }
      }
    }
  }
  return { clinics: DEMO_CLINICS.length, plans: plansMade, sessions: sessionsMade, flags: flagsMade };
}

/**
 * Before judging: re-create only the seeded plans with today's dates. Demo clinics (PIN, settings),
 * protected plans and every plan people made stay. The PIN is needed only when a demo clinic is missing.
 */
export async function refreshDemo(store: Store, today: string, pin?: string) {
  const prot = protectedPlanCodes();
  if (SEED_PLAN_CODES.some((c) => prot.includes(c))) throw new Error("a seed plan code is in PROTECTED_PLAN_CODES");
  await demoClinics(store, pin); // fails before deleting anything
  const removed = await store.deletePlansByCode(SEED_PLAN_CODES);
  return { removed, ...(await seedDemo(store, today, pin)) };
}
