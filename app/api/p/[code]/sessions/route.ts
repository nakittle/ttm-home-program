import { patientPlan } from "@/lib/api/guards";
import { SessionBody } from "@/lib/api/schemas";
import { addDays } from "@/lib/aggregate";
import { getStore } from "@/lib/db";
import { bangkokToday, fail, json, parseBody } from "@/lib/http";
import { evaluateRedFlags, worst } from "@/lib/redflags";

/**
 * Patient submits one session. The server re-evaluates the red flags with the same rules the phone used,
 * stores the session and the flags, and returns the response the phone should show.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await parseBody(req, SessionBody);
  if (body instanceof Response) return body;
  const plan = await patientPlan(req, code, body.secret);
  if (plan instanceof Response) return plan;
  if (!plan.consent_at) return fail(403, "no_consent", "โปรดกดยินยอมก่อนเริ่มใช้งาน");

  const s = body.session;
  const today = bangkokToday();
  if (s.performed_on > addDays(today, 1) || s.performed_on < addDays(plan.start_date, -1)) {
    return fail(400, "bad_date", "วันที่ไม่ถูกต้อง");
  }
  const allowed = new Set(plan.posture_ids);
  if (s.results.some((r) => !allowed.has(r.posture_id))) return fail(400, "bad_posture", "มีท่าที่ไม่อยู่ในแผน");

  const store = getStore();
  const clinic = await store.getClinic(plan.clinic_id);
  const fired = evaluateRedFlags({ answers: s.answers, painBefore: s.pain_before, painAfter: s.pain_after }, clinic?.settings);
  const postureOf = new Map(s.posture_flags.map((p) => [p.rule_id, p.posture_id]));
  const flags = fired.map((f) => ({ ...f, posture_id: postureOf.get(f.rule_id) ?? null }));

  const { row, created } = await store.insertSession({
    plan_id: plan.id,
    performed_on: s.performed_on,
    pain_before: s.pain_before,
    pain_after: s.pain_after,
    results: s.results,
    answers: s.answers,
    client_id: s.client_id,
  });
  if (created && flags.length) {
    await store.insertFlags(flags.map((f) => ({ plan_id: plan.id, session_id: row.id, rule_id: f.rule_id, level: f.level, posture_id: f.posture_id })));
  }
  return json({ ok: true, duplicate: !created, flags, worst: worst(flags) }, created ? 201 : 200);
}
