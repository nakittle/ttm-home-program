import { getStore } from "@/lib/db";
import { clinicIdFrom, fail, json, withErrors } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail(404, "not_found", "ไม่พบรายการนี้");
  const ok = await getStore().acknowledgeFlag(id, clinicId, new Date().toISOString());
  return ok ? json({ ok: true }) : fail(404, "not_found", "ไม่พบรายการนี้");
});
