import { patientPlan } from "@/lib/api/guards";
import { SecretBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { json, parseBody, withErrors } from "@/lib/http";
import { protectedPlanCodes } from "@/lib/seed";

/**
 * "ลบข้อมูลของฉัน": withdraw consent, delete every session and flag of the plan, stop an active plan (a completed plan stays completed).
 * A protected demo plan (the Concept Paper QR) only forgets the visitor and stays open, so the next judge starts at the consent screen.
 */
export const POST = withErrors(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const body = await parseBody(req, SecretBody);
  if (body instanceof Response) return body;
  const plan = await patientPlan(req, code, body.secret, { allowClosed: true });
  if (plan instanceof Response) return plan;
  const store = getStore();
  await store.deletePlanData(plan.id);
  if (protectedPlanCodes().includes(plan.code)) {
    await store.updatePlan(plan.id, { consent_at: null });
    return json({ ok: true });
  }
  await store.updatePlan(plan.id, {
    status: plan.status === "completed" ? "completed" : "stopped",
    consent_at: null,
    closed_at: plan.closed_at ?? new Date().toISOString(),
  });
  return json({ ok: true });
});
