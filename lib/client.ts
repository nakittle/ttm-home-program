"use client";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
  message_th?: string;
}

/** fetch + JSON for our own API. Network errors come back as status 0 instead of throwing. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { message_th?: string };
    return { ok: res.ok, status: res.status, data, message_th: data?.message_th };
  } catch {
    return { ok: false, status: 0, data: {} as T, message_th: "เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต" };
  }
}

const LOGGED_OUT = "hp_clinic_logged_out";

/** Enter the open demo clinic (no PIN) unless this tab chose to log out. True when a clinic session now exists. */
export async function enterOpenClinic(force = false): Promise<boolean> {
  try {
    if (!force && sessionStorage.getItem(LOGGED_OUT)) return false;
    sessionStorage.removeItem(LOGGED_OUT);
  } catch {}
  return (await api("/api/clinic/demo", { body: {} })).ok;
}

/** Remember for this tab that the user logged out, so the PIN form shows instead of the open clinic. */
export function markClinicLoggedOut() {
  try {
    sessionStorage.setItem(LOGGED_OUT, "1");
  } catch {}
}

/** Reject with Error("timeout") if `p` has not settled after `ms`; the timer is always cleared. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error("timeout")), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDaysLocal(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 2026-10-05 → "5 ต.ค. 2569" */
export function thaiDate(day: string): string {
  const m = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const [y, mo, d] = day.split("-").map(Number);
  return `${d} ${m[mo - 1]} ${y + 543}`;
}

export const pct = (x: number | null | undefined) => (x === null || x === undefined ? "–" : `${Math.round(x * 100)}%`);
