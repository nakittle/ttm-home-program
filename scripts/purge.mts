// Delete plans closed more than 90 days ago, with their sessions and flags (retention promise on the consent page).
// Phase 1: run by hand (npm run purge). A real deployment must schedule it.
import { SupabaseStore } from "../lib/db/supabase.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
const n = await new SupabaseStore(url, key).purgeClosedBefore(cutoff);
console.log(`deleted ${n} plan(s) closed before ${cutoff}`);
