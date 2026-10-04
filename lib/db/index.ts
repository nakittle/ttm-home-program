import "server-only";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const g = globalThis as unknown as { __hpStore?: Store };

/**
 * Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set; otherwise an in-memory store
 * (fine for local development and tests, but it forgets everything when the server restarts).
 */
export function getStore(): Store {
  if (!g.__hpStore) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    g.__hpStore = url && key ? new SupabaseStore(url, key) : new MemoryStore();
  }
  return g.__hpStore;
}

/** Tests replace the store. */
export function setStore(s: Store): void {
  g.__hpStore = s;
}

export function usingMemoryStore(): boolean {
  return getStore() instanceof MemoryStore;
}
