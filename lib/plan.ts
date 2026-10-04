import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
const DIGITS = "23456789"; // no 0, 1

/** Short code people can read aloud, e.g. "K7P-42" style: 3 letters + "-" + 2 digits. */
export function newPlanCode(): string {
  const l = Array.from({ length: 3 }, () => LETTERS[randomInt(LETTERS.length)]).join("");
  const d = Array.from({ length: 2 }, () => DIGITS[randomInt(DIGITS.length)]).join("");
  return `${l}-${d}`;
}

export const PLAN_CODE_RE = /^[A-HJ-NP-Z]{3}-[2-9]{2}$/;

/** 128-bit random secret, URL-safe. Shown once inside the QR, never stored in plain text. */
export function newSecret(): string {
  return randomBytes(16).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Constant-time comparison of a presented secret with the stored hash. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Patient link: the secret lives after "#", so it is never sent in the URL to the server or logged. */
export function patientUrl(origin: string, code: string, secret: string): string {
  return `${origin}/p/${code}#${secret}`;
}
