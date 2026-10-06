"use client";
import { del, get, set } from "idb-keyval";

export interface QueuedSession {
  code: string;
  /** The JSON body for POST /api/p/:code/sessions (without the secret). client_id identifies the item. */
  body: { client_id: string } & Record<string, unknown>;
}

const KEY = "hp:outbox";
const planKey = (code: string) => `hp:plan:${code}`;
const FLUSH_TIMEOUT_MS = 10_000; // one stalled upload must not hold up the rest

/** Every outbox mutation runs through this chain so read-modify-write cycles never interleave. */
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

/** Throws when storage is unreadable, so callers never overwrite data they could not read. */
async function readStrict(): Promise<QueuedSession[]> {
  return ((await get(KEY)) as QueuedSession[] | undefined) ?? [];
}

async function readLenient(): Promise<QueuedSession[]> {
  try {
    return await readStrict();
  } catch {
    return [];
  }
}

/** Returns false (and leaves existing data untouched) if storage failed. */
export function enqueue(item: QueuedSession): Promise<boolean> {
  return exclusive(async () => {
    try {
      const list = await readStrict();
      list.push(item);
      await set(KEY, list);
      return true;
    } catch {
      return false;
    }
  });
}

/** Remove one session once the server has it (or will never take it). */
export function dequeue(code: string, clientId: string): Promise<void> {
  return exclusive(async () => {
    try {
      const list = await readStrict();
      await set(KEY, list.filter((q) => !(q.code === code && q.body.client_id === clientId)));
    } catch {
      // could not write back: the item stays queued and the server dedupes it on the next flush
    }
  });
}

export async function pendingCount(code: string): Promise<number> {
  return (await readLenient()).filter((q) => q.code === code).length;
}

/**
 * Send every queued session for this plan. Sessions carry a client_id, so a retry that the server
 * already stored comes back as a duplicate instead of being counted twice. Sessions enqueued while
 * the network calls are in flight are kept: only the items that were sent or dropped are removed.
 */
export async function flush(code: string, secret: string): Promise<number> {
  const snapshot = (await readLenient()).filter((q) => q.code === code);
  const done = new Set<string>();
  let sent = 0;
  for (const q of snapshot) {
    // AbortController + timer rather than AbortSignal.timeout, which older iPhones do not have.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), FLUSH_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/p/${code}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, session: q.body }),
        signal: abort.signal,
      });
      if (res.ok || res.status === 400 || res.status === 410) {
        sent++; // 400/410 will never succeed: drop
        done.add(q.body.client_id);
      }
    } catch {
      // offline, timed out or server error: keep for the next flush
    } finally {
      clearTimeout(timer);
    }
  }
  if (done.size > 0) {
    await exclusive(async () => {
      try {
        const latest = await readStrict();
        await set(KEY, latest.filter((q) => !(q.code === code && done.has(q.body.client_id))));
      } catch {
        // could not write back: the items stay queued and the server dedupes them on the next flush
      }
    });
  }
  return sent;
}

/** Last plan seen online, so the patient can still open it offline. */
export async function savePlan(code: string, plan: unknown): Promise<void> {
  try {
    await set(planKey(code), plan);
  } catch {}
}

export async function loadPlan<T>(code: string): Promise<T | null> {
  try {
    return ((await get(planKey(code))) as T | undefined) ?? null;
  } catch {
    return null;
  }
}

export function forgetPlan(code: string): Promise<void> {
  return exclusive(async () => {
    try {
      await del(planKey(code));
      const list = await readStrict();
      await set(KEY, list.filter((q) => q.code !== code));
    } catch {
      // storage unavailable: nothing to forget
    }
  });
}
