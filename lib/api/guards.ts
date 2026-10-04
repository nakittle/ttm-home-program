import { getStore } from "@/lib/db";
import type { PlanRow } from "@/lib/db/types";
import { allow, clientIp, clinicIdFrom, fail } from "@/lib/http";
import { secretMatches } from "@/lib/plan";
import { planCodeOk } from "./schemas";

/** Plan owned by the logged-in clinic, or an error response. */
export async function ownedPlan(req: Request, code: string): Promise<{ plan: PlanRow; clinicId: string } | Response> {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const plan = planCodeOk(code) ? await getStore().getPlanByCode(code) : null;
  if (!plan || plan.clinic_id !== clinicId) return fail(404, "not_found", "ไม่พบแผนนี้");
  return { plan, clinicId };
}

/** Plan for a patient presenting the secret from the QR. Same answer for "wrong code" and "wrong secret". */
export async function patientPlan(req: Request, code: string, secret: string, opts: { allowClosed?: boolean } = {}): Promise<PlanRow | Response> {
  if (!allow(`patient:${clientIp(req)}`, 120, 60_000)) return fail(429, "rate_limited", "ลองใหม่อีกครั้งในอีกสักครู่");
  const plan = planCodeOk(code) ? await getStore().getPlanByCode(code) : null;
  if (!plan || !secretMatches(secret, plan.secret_hash)) return fail(401, "bad_link", "ลิงก์นี้ใช้ไม่ได้แล้ว โปรดติดต่อคลินิก");
  if (!opts.allowClosed && plan.status !== "active") return fail(410, "closed", "แผนนี้ปิดแล้ว โปรดติดต่อคลินิก");
  return plan;
}
