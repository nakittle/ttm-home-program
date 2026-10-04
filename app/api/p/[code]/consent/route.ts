import { patientPlan } from "@/lib/api/guards";
import { SecretBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { json, parseBody } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await parseBody(req, SecretBody);
  if (body instanceof Response) return body;
  const plan = await patientPlan(req, code, body.secret);
  if (plan instanceof Response) return plan;
  const at = plan.consent_at ?? new Date().toISOString();
  if (!plan.consent_at) await getStore().updatePlan(plan.id, { consent_at: at });
  return json({ ok: true, consent_at: at });
}
