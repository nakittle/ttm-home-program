import { patientPlan } from "@/lib/api/guards";
import { fail, withErrors } from "@/lib/http";
import { buildIcs } from "@/lib/ics";
import { patientUrl } from "@/lib/plan";

/**
 * Calendar file for "เพิ่มลงปฏิทิน". The secret is in the query string here because calendar apps open the
 * link directly (the one exception to "secret only after #", accepted in the spec).
 */
export const GET = withErrors(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const secret = url.searchParams.get("k") ?? "";
  if (!/^[A-Za-z0-9_-]{22}$/.test(secret)) return fail(401, "bad_link", "ลิงก์นี้ใช้ไม่ได้แล้ว โปรดติดต่อคลินิก");
  const plan = await patientPlan(req, code, secret);
  if (plan instanceof Response) return plan;
  const ics = buildIcs({
    code: plan.code,
    daysPerWeek: plan.days_per_week,
    remindTime: plan.remind_time,
    startDate: plan.start_date,
    untilDate: plan.next_visit_date,
    url: patientUrl(url.origin, plan.code, secret),
  });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="homework-${plan.code}.ics"`,
      "cache-control": "no-store",
    },
  });
});
