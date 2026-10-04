import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/db";
import { MemoryStore } from "@/lib/db/memory";
import { SupabaseStore } from "@/lib/db/supabase";

describe("getStore", () => {
  beforeEach(() => {
    resetStoreForTests();
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("ALLOW_MEMORY_STORE", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetStoreForTests();
  });

  it("throws in production when Supabase is not configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getStore()).toThrow("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co"); // key still missing
    expect(() => getStore()).toThrow(/Supabase is not configured/);
  });

  it("allows the memory store in production only with ALLOW_MEMORY_STORE=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_MEMORY_STORE", "1");
    expect(getStore()).toBeInstanceOf(MemoryStore);
  });

  it("uses the memory store outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getStore()).toBeInstanceOf(MemoryStore);
  });

  it("uses Supabase when configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    expect(getStore()).toBeInstanceOf(SupabaseStore);
  });
});

describe("MemoryStore flags", () => {
  it("skips a duplicate (session_id, rule_id) like the unique constraint", async () => {
    const s = new MemoryStore();
    const f = { plan_id: "p1", session_id: "s1", rule_id: "RF04", level: "stop_and_contact_clinic" as const, posture_id: null };
    expect(await s.insertFlags([f, { ...f, rule_id: "RF09", level: "note_for_next_visit" as const }])).toHaveLength(2);
    expect(await s.insertFlags([f])).toHaveLength(0);
    expect(await s.insertFlags([f, f])).toHaveLength(0);
    expect(s.flags).toHaveLength(2);
    expect(await s.insertFlags([{ ...f, session_id: "s2" }])).toHaveLength(1);
  });
});
