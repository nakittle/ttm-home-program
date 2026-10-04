"use client";
import { del, get, set } from "idb-keyval";

export interface QueuedSession {
  code: string;
  body: unknown; // the JSON body for POST /api/p/:code/sessions (without the secret)
}

const KEY = "hp:outbox";
const planKey = (code: string) => `hp:plan:${code}`;

async function read(): Promise<QueuedSession[]> {
  try {
    return ((await get(KEY)) as QueuedSession[] | undefined) ?? [];
  } catch {
    return [];
  }
}

export async function enqueue(item: QueuedSession): Promise<void> {
  const list = await read();
  list.push(item);
  await set(KEY, list);
}

export async function pendingCount(code: string): Promise<number> {
  return (await read()).filter((q) => q.code === code).length;
}

/**
 * Send every queued session for this plan. Sessions carry a client_id, so a retry that the server
 * already stored comes back as a duplicate instead of being counted twice.
 */
export async function flush(code: string, secret: string): Promise<number> {
  const list = await read();
  const keep: QueuedSession[] = [];
  let sent = 0;
  for (const q of list) {
    if (q.code !== code) {
      keep.push(q);
      continue;
    }
    try {
      const res = await fetch(`/api/p/${code}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, session: q.body }),
      });
      if (res.ok || res.status === 400 || res.status === 410) sent++; // 400/410 will never succeed: drop
      else keep.push(q);
    } catch {
      keep.push(q);
    }
  }
  await set(KEY, keep);
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

export async function forgetPlan(code: string): Promise<void> {
  await del(planKey(code));
  await set(KEY, (await read()).filter((q) => q.code !== code));
}
