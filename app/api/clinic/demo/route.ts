import { CLINIC_COOKIE, readSession, signSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { allow, clientIp, fail, json, readCookie, setCookie, withErrors } from "@/lib/http";

/**
 * Open entry for judges and visitors: a clinic session for one synthetic demo clinic, no PIN.
 * DEMO-B holds only seeded plans; DEMO-A (the permanent demo plan and the team's own plans) stays behind its PIN.
 * An existing clinic session is kept as is, so a PIN login is never swapped for the open one.
 */
const openClinicCode = () => process.env.OPEN_CLINIC_CODE ?? "DEMO-B";

export const POST = withErrors(async (req: Request) => {
  const current = await readSession(readCookie(req, CLINIC_COOKIE));
  if (current?.role === "clinic") return json({ ok: true, kept: true });
  if (!allow(`demo:${clientIp(req)}`, 30, 60_000)) return fail(429, "rate_limited", "ลองใหม่อีกครั้งในอีกสักครู่");
  const clinic = await getStore().getClinicByCode(openClinicCode());
  if (!clinic) return fail(404, "no_demo_clinic", "ยังไม่มีคลินิกทดลอง");
  const token = await signSession({ role: "clinic", clinicId: clinic.id });
  return json({ ok: true, clinic: { code: clinic.code, name: clinic.name } }, 200, { "set-cookie": setCookie(CLINIC_COOKIE, token) });
});
