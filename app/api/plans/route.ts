import { CreatePlanBody } from "@/lib/api/schemas";
import { getStore } from "@/lib/db";
import { DuplicateCodeError } from "@/lib/db/types";
import { allow, clientIp, clinicIdFrom, fail, json, parseBody, withErrors } from "@/lib/http";
import { hashSecret, newPlanCode, newSecret } from "@/lib/plan";

/** Clinic creates a plan. The secret is returned once (for the QR) and only its hash is stored. */
export const POST = withErrors(async (req: Request) => {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  if (!allow(`plans:${clientIp(req)}`, 60, 60_000)) return fail(429, "rate_limited", "ลองใหม่อีกครั้งในอีกสักครู่");
  const body = await parseBody(req, CreatePlanBody);
  if (body instanceof Response) return body;

  const secret = newSecret();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const plan = await getStore().insertPlan({ ...body, code: newPlanCode(), secret_hash: hashSecret(secret), clinic_id: clinicId });
      return json({ code: plan.code, secret }, 201);
    } catch (e) {
      if (!(e instanceof DuplicateCodeError)) throw e;
    }
  }
  return fail(503, "code_exhausted", "สร้างรหัสแผนไม่สำเร็จ โปรดลองใหม่");
});
