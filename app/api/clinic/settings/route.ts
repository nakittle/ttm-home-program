import { SettingsBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { clinicIdFrom, fail, json, parseBody } from "@/lib/http";

/** Clinics may only change rules marked clinic_adjustable (🟡/⚪). */
export async function PUT(req: Request) {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const body = await parseBody(req, SettingsBody);
  if (body instanceof Response) return body;
  await getStore().updateClinicSettings(clinicId, body);
  return json({ ok: true, settings: body });
}
