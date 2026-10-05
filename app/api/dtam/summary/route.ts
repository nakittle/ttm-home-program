import { dtamSummary } from "@/lib/aggregate";
import { getStore } from "@/lib/db";
import { allow, bangkokToday, clientIp, fail, json, withErrors } from "@/lib/http";

/** Open to everyone (judges test without a password): aggregates only, cells under MIN_CELL are suppressed, no per-person data. */
export const GET = withErrors(async (req: Request) => {
  if (!allow(`dtam-summary:${clientIp(req)}`, 60, 60_000)) return fail(429, "rate_limited", "ขอข้อมูลถี่เกินไป รอสักครู่แล้วลองอีกครั้ง");
  const store = getStore();
  const [clinics, plans, sessions, flags] = await Promise.all([store.listClinics(), store.listPlans(), store.listSessions(), store.listFlags()]);
  return json(dtamSummary(clinics, plans, sessions, flags, bangkokToday()));
});
