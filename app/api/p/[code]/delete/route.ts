import { patientPlan } from "@/lib/api/guards";
import { SecretBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { json, parseBody, withErrors } from "@/lib/http";

/** "ลบข้อมูลของฉัน": withdraw consent, delete every session and flag of the plan, stop the plan. */
export const POST = withErrors(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const body = await parseBody(req, SecretBody);
  if (body instanceof Response) return body;
  const plan = await patientPlan(req, code, body.secret, { allowClosed: true });
  if (plan instanceof Response) return plan;
  const store = getStore();
  await store.deletePlanData(plan.id);
  await store.updatePlan(plan.id, { status: "stopped", consent_at: null, closed_at: new Date().toISOString() });
  return json({ ok: true });
});
