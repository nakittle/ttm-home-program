import { CLINIC_COOKIE } from "@/lib/auth";
import { json, setCookie } from "@/lib/http";

export async function POST() {
  return json({ ok: true }, 200, { "set-cookie": setCookie(CLINIC_COOKIE, "", 0) });
}
