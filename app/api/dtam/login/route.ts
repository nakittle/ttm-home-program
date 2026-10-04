import { timingSafeEqual } from "node:crypto";
import { DTAM_COOKIE, signSession } from "@/lib/auth";
import { DtamLoginBody } from "@/lib/api/schemas";
import { allow, clientIp, fail, json, parseBody, setCookie, withErrors } from "@/lib/http";

/** Single demo password for the DTAM overview (DTAM_DEMO_PASSWORD). */
export const POST = withErrors(async (req: Request) => {
  if (!allow(`dtam:${clientIp(req)}`, 10, 60_000)) return fail(429, "rate_limited", "ลองใหม่อีกครั้งในอีกสักครู่");
  const body = await parseBody(req, DtamLoginBody);
  if (body instanceof Response) return body;
  const want = Buffer.from(process.env.DTAM_DEMO_PASSWORD ?? "");
  const got = Buffer.from(body.password);
  if (want.length === 0 || want.length !== got.length || !timingSafeEqual(want, got)) return fail(401, "bad_login", "รหัสผ่านไม่ถูกต้อง");
  return json({ ok: true }, 200, { "set-cookie": setCookie(DTAM_COOKIE, await signSession({ role: "dtam" })) });
});
