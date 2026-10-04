import { timingSafeEqual } from "node:crypto";
import { ResetBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { bangkokToday, fail, json, parseBody } from "@/lib/http";
import { seedDemo } from "@/lib/seed";

/** Wipe and re-create the demo data. Disabled unless DEMO_RESET_TOKEN is set. */
export async function POST(req: Request) {
  const token = process.env.DEMO_RESET_TOKEN;
  if (!token) return fail(404, "not_found", "ไม่พบ");
  const body = await parseBody(req, ResetBody);
  if (body instanceof Response) return body;
  const a = Buffer.from(token);
  const b = Buffer.from(body.token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail(401, "bad_token", "โทเคนไม่ถูกต้อง");
  const store = getStore();
  await store.resetAll();
  const counts = await seedDemo(store, bangkokToday(), process.env.DEMO_CLINIC_PIN ?? "246810");
  return json({ ok: true, ...counts });
}
