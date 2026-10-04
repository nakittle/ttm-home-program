import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();
const failure = { read: false };

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (k: string) => {
    if (failure.read) throw new Error("idb read failed");
    return store.get(k);
  }),
  set: vi.fn(async (k: string, v: unknown) => {
    store.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    store.delete(k);
  }),
}));

import { enqueue, flush, pendingCount, type QueuedSession } from "@/lib/offline";

const item = (id: string, code = "ABC"): QueuedSession => ({ code, body: { client_id: id } });
const outbox = () => (store.get("hp:outbox") as QueuedSession[] | undefined) ?? [];
const ids = () => outbox().map((q) => q.body.client_id);

beforeEach(() => {
  store.clear();
  failure.read = false;
  vi.unstubAllGlobals();
});

describe("offline outbox", () => {
  it("keeps a session enqueued while flush is awaiting the network", async () => {
    await enqueue(item("a"));
    let release: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (release = resolve))),
    );
    const flushing = flush("ABC", "secret");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const enqueued = enqueue(item("b")); // arrives mid-flush
    release(new Response("{}", { status: 201 }));
    expect(await flushing).toBe(1);
    expect(await enqueued).toBe(true);
    expect(ids()).toEqual(["b"]);
    expect(await pendingCount("ABC")).toBe(1);
  });

  it("returns false and leaves the queue alone when storage cannot be read", async () => {
    await enqueue(item("a"));
    failure.read = true;
    expect(await enqueue(item("b"))).toBe(false);
    failure.read = false;
    expect(ids()).toEqual(["a"]);
  });

  it("drops 201 and 400, keeps 503 and network errors", async () => {
    for (const id of ["ok", "bad", "busy", "offline"]) await enqueue(item(id));
    await enqueue(item("other", "ZZZ"));
    const status: Record<string, number> = { ok: 201, bad: 400, busy: 503 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const id = (JSON.parse(init.body) as { session: { client_id: string } }).session.client_id;
        if (id === "offline") throw new TypeError("network down");
        return new Response("{}", { status: status[id] });
      }),
    );
    expect(await flush("ABC", "secret")).toBe(2);
    expect(ids()).toEqual(["busy", "offline", "other"]);
  });
});
