import { CLINIC_COOKIE, signSession, verifyPin } from "@/lib/auth";
import { LoginBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { allow, clearFailures, clientIp, fail, isLocked, json, parseBody, recordFailure, setCookie, withErrors } from "@/lib/http";

export const POST = withErrors(async (req: Request) => {
  if (!allow(`login:${clientIp(req)}`, 20, 60_000)) return fail(429, "rate_limited", "ลองใหม่อีกครั้งในอีกสักครู่");
  const body = await parseBody(req, LoginBody);
  if (body instanceof Response) return body;
  const code = body.code.trim().toUpperCase();
  if (isLocked(code)) return fail(429, "locked", "ใส่ PIN ผิดหลายครั้ง โปรดรอ 5 นาที");

  const clinic = await getStore().getClinicByCode(code);
  if (!clinic || !verifyPin(body.pin, clinic.pin_hash)) {
    recordFailure(code);
    return fail(401, "bad_login", "รหัสคลินิกหรือ PIN ไม่ถูกต้อง");
  }
  clearFailures(code);
  const token = await signSession({ role: "clinic", clinicId: clinic.id });
  return json({ ok: true, clinic: { code: clinic.code, name: clinic.name } }, 200, { "set-cookie": setCookie(CLINIC_COOKIE, token) });
});
