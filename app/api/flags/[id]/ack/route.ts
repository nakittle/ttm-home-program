import { getStore } from "@/lib/db";
import { clinicIdFrom, fail, json } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const { id } = await ctx.params;
  const ok = await getStore().acknowledgeFlag(id, clinicId, new Date().toISOString());
  return ok ? json({ ok: true }) : fail(404, "not_found", "ไม่พบรายการนี้");
}
