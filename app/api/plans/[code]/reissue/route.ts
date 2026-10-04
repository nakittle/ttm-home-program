import { ownedPlan } from "@/lib/api/guards";
import { getStore } from "@/lib/db";
import { json } from "@/lib/http";
import { hashSecret, newSecret } from "@/lib/plan";

/** New slip for a lost QR: replaces the secret, so the old link stops working. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const owned = await ownedPlan(req, code);
  if (owned instanceof Response) return owned;
  const secret = newSecret();
  await getStore().updatePlan(owned.plan.id, { secret_hash: hashSecret(secret) });
  return json({ code, secret });
}
