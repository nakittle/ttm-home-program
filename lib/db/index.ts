import "server-only";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const g = globalThis as unknown as { __hpStore?: Store };

/**
 * Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set; otherwise an in-memory store
 * (fine for local development and tests, but it forgets everything when the server restarts).
 * In production a missing Supabase config is an error (an in-memory store on serverless would silently lose
 * data), unless ALLOW_MEMORY_STORE=1 is set on purpose, e.g. for a local `next start`.
 */
export function getStore(): Store {
  if (!g.__hpStore) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) g.__hpStore = new SupabaseStore(url, key);
    else if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_STORE !== "1") {
      throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    } else g.__hpStore = new MemoryStore();
  }
  return g.__hpStore;
}

/** Tests replace the store. */
export function setStore(s: Store): void {
  g.__hpStore = s;
}

/** Tests only: forget the cached store so the next getStore() decides again from the environment. */
export function resetStoreForTests(): void {
  g.__hpStore = undefined;
}

export function usingMemoryStore(): boolean {
  return getStore() instanceof MemoryStore;
}
