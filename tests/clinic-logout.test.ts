import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearClinicLoggedOut, enterOpenClinic, markClinicLoggedOut } from "@/lib/client";

/** Minimal Web Storage; each call makes a fresh store, like a new tab's sessionStorage. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (n) => [...m.keys()][n] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const throwing = new Proxy({} as Storage, {
  get() {
    throw new Error("SecurityError");
  },
});

let fetchMock: ReturnType<typeof vi.fn>;
const demoCalls = () => fetchMock.mock.calls.filter(([path]) => path === "/api/clinic/demo").length;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
});
afterEach(() => vi.unstubAllGlobals());

describe("clinic logout flag", () => {
  it("enters the open demo clinic when nobody logged out", async () => {
    expect(await enterOpenClinic()).toBe(true);
    expect(demoCalls()).toBe(1);
  });

  it("a logout in one tab keeps every other tab out of the open clinic", async () => {
    markClinicLoggedOut();
    vi.stubGlobal("sessionStorage", memoryStorage()); // another tab: its own sessionStorage, same localStorage
    expect(await enterOpenClinic()).toBe(false);
    expect(demoCalls()).toBe(0);
  });

  it("the open-clinic button (force) clears the flag for later refreshes", async () => {
    markClinicLoggedOut();
    expect(await enterOpenClinic(true)).toBe(true);
    expect(await enterOpenClinic()).toBe(true);
    expect(demoCalls()).toBe(2);
  });

  it("a PIN login clears the flag", async () => {
    markClinicLoggedOut();
    clearClinicLoggedOut();
    expect(await enterOpenClinic()).toBe(true);
    expect(demoCalls()).toBe(1);
  });

  it("blocked storage never throws and falls back to the open clinic", async () => {
    vi.stubGlobal("localStorage", throwing);
    expect(() => markClinicLoggedOut()).not.toThrow();
    expect(() => clearClinicLoggedOut()).not.toThrow();
    expect(await enterOpenClinic()).toBe(true);
  });
});
