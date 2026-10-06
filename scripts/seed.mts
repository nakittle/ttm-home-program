// Put the demo data (3 demo clinics, ~60 plans, 8 weeks) into Supabase.
// Run: npm run seed                 (first time; refuses if demo clinics already exist)
//      npm run seed -- --refresh    (before judging: re-creates only the seeded plans with today's dates;
//                                    clinics, their PINs, TCX-86 and every plan people made stay)
//      npm run seed -- --reset      (deletes EVERYTHING first; refuses while a protected plan such as TCX-86 exists)
//      npm run seed -- --reset --wipe-everything   (deletes everything, protected plans too)
// DEMO_CLINIC_PIN (in .env.local) is needed only when a demo clinic has to be created.
import { SupabaseStore } from "../lib/db/supabase.ts";
import { protectedPlanCodes, refreshDemo, seedDemo } from "../lib/seed.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const store = new SupabaseStore(url, key);
const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const pin = process.env.DEMO_CLINIC_PIN || undefined;
const has = (flag: string) => process.argv.includes(flag);

if (has("--refresh")) {
  console.log("refreshed", await refreshDemo(store, today, pin));
  process.exit(0);
}
if (!has("--reset") && (await store.listClinics()).some((c) => c.is_demo)) {
  console.error("Demo clinics already exist. Use --refresh to renew the demo plans, or --reset to start over.");
  process.exit(1);
}
if (!pin) {
  console.error("Set DEMO_CLINIC_PIN in .env.local first (the PIN for the new demo clinics).");
  process.exit(1);
}
if (has("--reset")) {
  const kept: string[] = [];
  for (const code of protectedPlanCodes()) if (await store.getPlanByCode(code)) kept.push(code);
  if (kept.length && !has("--wipe-everything")) {
    console.error(`Refusing: protected plan(s) ${kept.join(", ")} exist. Use --refresh, or add --wipe-everything to delete them too.`);
    process.exit(1);
  }
  await store.resetAll();
  console.log("database cleared");
}
const counts = await seedDemo(store, today, pin);
console.log("seeded", counts);
