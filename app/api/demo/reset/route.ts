import { timingSafeEqual } from "node:crypto";
import { ResetBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { bangkokToday, fail, json, parseBody, withErrors } from "@/lib/http";
import { NoDemoPinError, refreshDemo } from "@/lib/seed";

/**
 * Re-create the seeded demo plans with today's dates. Clinics, their PINs and every other plan (TCX-86, plans made by people) stay.
 * Disabled unless DEMO_RESET_TOKEN is set.
 */
export const POST = withErrors(async (req: Request) => {
  const token = process.env.DEMO_RESET_TOKEN;
  if (!token) return fail(404, "not_found", "ไม่พบ");
  const body = await parseBody(req, ResetBody);
  if (body instanceof Response) return body;
  const a = Buffer.from(token);
  const b = Buffer.from(body.token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail(401, "bad_token", "โทเคนไม่ถูกต้อง");
  try {
    const counts = await refreshDemo(getStore(), bangkokToday(), process.env.DEMO_CLINIC_PIN || undefined);
    return json({ ok: true, ...counts });
  } catch (e) {
    if (e instanceof NoDemoPinError) return fail(409, "no_demo_pin", "ยังไม่ได้ตั้ง DEMO_CLINIC_PIN จึงสร้างคลินิกเดโมไม่ได้");
    throw e;
  }
});
