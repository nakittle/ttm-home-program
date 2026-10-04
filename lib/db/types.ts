import type { RedFlagLevel } from "@/lib/content/schema";
import type { PostureResult } from "@/lib/pose/session";
import type { Answers, ClinicRuleSettings } from "@/lib/redflags";

// No table has a name, national ID, phone of a patient, or HN.

export interface ClinicRow {
  id: string;
  code: string;
  name: string;
  pin_hash: string;
  phone: string | null; // the clinic's phone, shown to patients
  is_demo: boolean;
  settings: ClinicRuleSettings;
  created_at: string;
}

export type PlanStatus = "active" | "completed" | "stopped";

export interface PlanRow {
  id: string;
  code: string;
  secret_hash: string;
  clinic_id: string;
  group_ids: string[];
  posture_ids: string[];
  days_per_week: number;
  remind_time: string; // HH:MM
  start_date: string; // YYYY-MM-DD
  next_visit_date: string; // YYYY-MM-DD
  status: PlanStatus;
  consent_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  plan_id: string;
  performed_on: string; // YYYY-MM-DD (patient's local date)
  pain_before: number | null;
  pain_after: number | null;
  results: PostureResult[];
  answers: Answers;
  client_id: string; // generated on the phone; makes retries idempotent
  created_at: string;
}

export interface FlagRow {
  id: string;
  plan_id: string;
  session_id: string | null;
  rule_id: string;
  level: RedFlagLevel;
  posture_id: string | null;
  created_at: string;
  acknowledged_at: string | null;
}

export type NewPlan = Omit<PlanRow, "id" | "created_at" | "consent_at" | "closed_at" | "status">;
export type NewSession = Omit<SessionRow, "id" | "created_at">;
export type NewFlag = Omit<FlagRow, "id" | "created_at" | "acknowledged_at">;
export type NewClinic = Omit<ClinicRow, "id" | "created_at">;

export class DuplicateCodeError extends Error {}

export interface Store {
  listClinics(): Promise<ClinicRow[]>;
  getClinic(id: string): Promise<ClinicRow | null>;
  getClinicByCode(code: string): Promise<ClinicRow | null>;
  insertClinic(c: NewClinic): Promise<ClinicRow>;
  updateClinicSettings(id: string, settings: ClinicRuleSettings): Promise<void>;

  insertPlan(p: NewPlan): Promise<PlanRow>; // throws DuplicateCodeError
  getPlanByCode(code: string): Promise<PlanRow | null>;
  updatePlan(id: string, patch: Partial<Pick<PlanRow, "status" | "next_visit_date" | "secret_hash" | "consent_at" | "closed_at">>): Promise<void>;
  listPlans(filter?: { clinicId?: string }): Promise<PlanRow[]>;

  /** Returns the existing row when (plan_id, client_id) was already stored. */
  insertSession(s: NewSession): Promise<{ row: SessionRow; created: boolean }>;
  listSessions(filter?: { planIds?: string[] }): Promise<SessionRow[]>;

  insertFlags(f: NewFlag[]): Promise<FlagRow[]>;
  listFlags(filter?: { planIds?: string[] }): Promise<FlagRow[]>;
  acknowledgeFlag(id: string, clinicId: string, at: string): Promise<boolean>;

  /** Patient withdrawal: delete sessions and flags of a plan. */
  deletePlanData(planId: string): Promise<void>;
  /** Delete plans closed before the date together with their data. Returns how many plans. */
  purgeClosedBefore(isoDate: string): Promise<number>;
  /** Demo only: remove everything. */
  resetAll(): Promise<void>;
}
