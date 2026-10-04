import { clinicDashboard } from "@/lib/aggregate";
import { getStore, usingMemoryStore } from "@/lib/db";
import { bangkokToday, clinicIdFrom, fail, json } from "@/lib/http";

export async function GET(req: Request) {
  const clinicId = await clinicIdFrom(req);
  if (!clinicId) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const store = getStore();
  const clinic = await store.getClinic(clinicId);
  if (!clinic) return fail(401, "unauthorized", "โปรดเข้าสู่ระบบคลินิก");
  const plans = await store.listPlans({ clinicId });
  const ids = plans.map((p) => p.id);
  const [sessions, flags] = await Promise.all([store.listSessions({ planIds: ids }), store.listFlags({ planIds: ids })]);
  return json({
    clinic: { code: clinic.code, name: clinic.name, phone: clinic.phone, is_demo: clinic.is_demo, settings: clinic.settings },
    items: clinicDashboard(plans, sessions, flags, bangkokToday()),
    data_as_of: new Date().toISOString(),
    memory_store: usingMemoryStore(),
  });
}
