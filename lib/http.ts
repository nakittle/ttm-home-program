import type { z } from "zod";
import { CLINIC_COOKIE, cookieOptions, readSession } from "@/lib/auth";

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });

/** Thai error message for people, short code for the app. Never includes stack traces. */
export const fail = (status: number, code: string, message_th: string) => json({ error: code, message_th }, status);

/** Wrap a route handler so an unexpected exception becomes the same JSON envelope as every other error (no stack, no details). */
export function withErrors<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A): Promise<Response> => {
    try {
      return await fn(...a);
    } catch (e) {
      console.error(e);
      return fail(500, "server_error", "ระบบขัดข้อง โปรดลองใหม่อีกครั้ง");
    }
  };
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "bad_json", "ข้อมูลไม่ถูกต้อง");
  }
  const r = schema.safeParse(raw);
  return r.success ? r.data : fail(400, "bad_request", "ข้อมูลไม่ครบหรือไม่ถูกต้อง");
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function setCookie(name: string, value: string, maxAge = cookieOptions.maxAge): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${cookieOptions.path}`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (cookieOptions.secure) parts.push("Secure");
  return parts.join("; ");
}

export async function clinicIdFrom(req: Request): Promise<string | null> {
  const s = await readSession(readCookie(req, CLINIC_COOKIE));
  return s?.role === "clinic" ? s.clinicId : null;
}


// --- rate limiting (per server instance; good enough for a prototype) ---
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** true when the caller is still under `limit` requests per `windowMs` for this bucket. */
export function allow(bucket: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const list = (hits.get(bucket) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(bucket, list);
    return false;
  }
  list.push(now);
  hits.set(bucket, list);
  return true;
}

// --- PIN lockout: 5 wrong PINs lock a clinic code for 5 minutes ---
const failures = new Map<string, { count: number; until: number }>();

export function isLocked(code: string, now = Date.now()): boolean {
  const f = failures.get(code);
  return !!f && f.until > now;
}

export function recordFailure(code: string, now = Date.now()): void {
  const count = (failures.get(code)?.count ?? 0) + 1;
  failures.set(code, { count, until: count >= 5 ? now + 5 * 60_000 : 0 });
}

export function clearFailures(code: string): void {
  failures.delete(code);
}

export function resetRateLimits(): void {
  hits.clear();
  failures.clear();
}

/** Today in Thailand (UTC+7) as YYYY-MM-DD. */
export function bangkokToday(now = Date.now()): string {
  return new Date(now + 7 * 3600_000).toISOString().slice(0, 10);
}
