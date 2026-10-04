import { patientPlan } from "@/lib/api/guards";
import { SecretBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { json, parseBody, withErrors } from "@/lib/http";

/** What the patient's phone needs to run the plan. No clinic-internal data. */
export const POST = withErrors(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const body = await parseBody(req, SecretBody);
  if (body instanceof Response) return body;
  const plan = await patientPlan(req, code, body.secret, { allowClosed: true });
  if (plan instanceof Response) return plan;
  const clinic = await getStore().getClinic(plan.clinic_id);
  return json({
    code: plan.code,
    status: plan.status,
    group_ids: plan.group_ids,
    posture_ids: plan.posture_ids,
    days_per_week: plan.days_per_week,
    remind_time: plan.remind_time,
    start_date: plan.start_date,
    next_visit_date: plan.next_visit_date,
    consent_at: plan.consent_at,
    clinic: { name: clinic?.name ?? "", phone: clinic?.phone ?? null },
    settings: clinic?.settings ?? { disabled: [], thresholds: {} },
  });
});
