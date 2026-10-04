import { dtamSummary } from "@/lib/aggregate";
import { getStore } from "@/lib/db";
import { bangkokToday, fail, isDtam, json, withErrors } from "@/lib/http";

export const GET = withErrors(async (req: Request) => {
  if (!(await isDtam(req))) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบ");
  const store = getStore();
  const [clinics, plans, sessions, flags] = await Promise.all([store.listClinics(), store.listPlans(), store.listSessions(), store.listFlags()]);
  return json(dtamSummary(clinics, plans, sessions, flags, bangkokToday()));
});
