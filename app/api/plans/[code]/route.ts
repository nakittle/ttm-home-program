import { ownedPlan } from "@/lib/api/guards";
import { PatchPlanBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { json, parseBody, withErrors } from "@/lib/http";

/** Clinic closes a plan (completed / stopped) or moves the next visit. */
export const PATCH = withErrors(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const owned = await ownedPlan(req, code);
  if (owned instanceof Response) return owned;
  const body = await parseBody(req, PatchPlanBody);
  if (body instanceof Response) return body;
  const patch: Parameters<ReturnType<typeof getStore>["updatePlan"]>[1] = {};
  if (body.next_visit_date) patch.next_visit_date = body.next_visit_date;
  if (body.status) {
    patch.status = body.status;
    patch.closed_at = new Date().toISOString();
  }
  await getStore().updatePlan(owned.plan.id, patch);
  return json({ ok: true });
});
