import { z } from "zod";
import { activeGroups, postures, redflags } from "@/lib/content";
import { PLAN_CODE_RE } from "@/lib/plan";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const postureId = z.enum(postures.map((p) => p.id) as [string, ...string[]]);
const groupId = z.enum(activeGroups().map((g) => g.id) as [string, ...string[]]);
const ruleId = z.enum(redflags.rules.map((r) => r.id) as [string, ...string[]]);
const adjustable = redflags.rules.filter((r) => r.clinic_adjustable).map((r) => r.id);

export const LoginBody = z.object({ code: z.string().min(2).max(20), pin: z.string().regex(/^\d{6}$/) });
export const DtamLoginBody = z.object({ password: z.string().min(1).max(100) });

export const CreatePlanBody = z
  .object({
    group_ids: z.array(groupId).min(1).max(3),
    posture_ids: z.array(postureId).min(1).max(13),
    days_per_week: z.number().int().min(1).max(7),
    remind_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    start_date: date,
    next_visit_date: date,
  })
  .refine((b) => b.next_visit_date > b.start_date, { message: "next visit must be after start" });

export const PatchPlanBody = z.object({
  status: z.enum(["completed", "stopped"]).optional(),
  next_visit_date: date.optional(),
});

export const SettingsBody = z.object({
  disabled: z.array(z.string()).refine((ids) => ids.every((id) => adjustable.includes(id)), "only adjustable rules"),
  thresholds: z.record(z.string(), z.number().min(1).max(10)).refine((t) => Object.keys(t).every((id) => adjustable.includes(id)), "only adjustable rules"),
});

export const SecretBody = z.object({ secret: z.string().regex(/^[A-Za-z0-9_-]{22}$/) });

export const PostureResultSchema = z.object({
  posture_id: postureId,
  method: z.enum(["camera", "button", "skipped"]),
  units_done: z.number().int().min(0).max(20),
  units_target: z.number().int().min(1).max(20),
  seconds_held: z.number().min(0).max(3600),
});

export const SessionBody = SecretBody.extend({
  session: z.object({
    client_id: z.string().min(8).max(64),
    performed_on: date,
    pain_before: z.number().int().min(0).max(10).nullable(),
    pain_after: z.number().int().min(0).max(10).nullable(),
    results: z.array(PostureResultSchema).max(13),
    answers: z.partialRecord(ruleId, z.boolean()),
    posture_flags: z.array(z.object({ rule_id: ruleId, posture_id: postureId })).max(30).default([]),
  }),
});

export const ResetBody = z.object({ token: z.string().min(8) });

export const planCodeOk = (code: string) => PLAN_CODE_RE.test(code);
