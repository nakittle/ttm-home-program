import { CLINIC_COOKIE } from "@/lib/auth";
import { json, setCookie, withErrors } from "@/lib/http";

export const POST = withErrors(async () => {
  return json({ ok: true }, 200, { "set-cookie": setCookie(CLINIC_COOKIE, "", 0) });
});
