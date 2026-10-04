import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

const HASH_BYTES = 32;
const HEX = /^(?:[0-9a-f]{2})+$/i;

/** "scrypt$<salt hex>$<hash hex>" */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, HASH_BYTES);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  if (!HEX.test(saltHex) || !HEX.test(hashHex)) return false;
  const want = Buffer.from(hashHex, "hex");
  if (want.length !== HASH_BYTES) return false;
  const got = scryptSync(pin, Buffer.from(saltHex, "hex"), HASH_BYTES);
  return timingSafeEqual(want, got);
}

export type SessionClaims = { role: "clinic"; clinicId: string } | { role: "dtam" };

export const CLINIC_COOKIE = "hp_clinic";
export const DTAM_COOKIE = "hp_dtam";
export const SESSION_HOURS = 12;

function key(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function readSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.role === "clinic" && typeof payload.clinicId === "string") return { role: "clinic", clinicId: payload.clinicId };
    if (payload.role === "dtam") return { role: "dtam" };
    return null;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_HOURS * 3600,
};
