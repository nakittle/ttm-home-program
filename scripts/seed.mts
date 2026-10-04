// Put the demo data (3 demo clinics, ~60 plans, 8 weeks) into Supabase.
// Run: npm run seed            (refuses if demo clinics already exist)
//      npm run seed -- --reset (deletes EVERYTHING in the database first)
import { SupabaseStore } from "../lib/db/supabase.ts";
import { seedDemo } from "../lib/seed.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const store = new SupabaseStore(url, key);
const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

if (process.argv.includes("--reset")) {
  await store.resetAll();
  console.log("database cleared");
} else if ((await store.listClinics()).some((c) => c.is_demo)) {
  console.error("Demo clinics already exist. Use --reset to start over.");
  process.exit(1);
}
const counts = await seedDemo(store, today, process.env.DEMO_CLINIC_PIN ?? "246810");
console.log("seeded", counts);
