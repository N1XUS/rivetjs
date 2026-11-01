// Password hashing with scrypt from node:crypto (memory-hard, no native addon). Stored as
// `scrypt$N$r$p$<salt>$<key>` so the cost can be raised later: `needsRehash` tells the sign-in to upgrade a hash.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

// OWASP Password Storage Cheat Sheet scrypt options: N=2^14 (16 MiB), r=8, p=5 (CPU-equivalent to N=2^17, p=1 at
// an eighth of the memory). Async: hashing never blocks the event loop.
const COST = { N: 2 ** 14, r: 8, p: 5 };
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

const scrypt = (password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scryptCallback(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: 256 * options.N! * options.r! }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

/** A new hash with a fresh random per-user salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, COST);
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/** Constant-time comparison of the derived key; a malformed stored hash never matches. */
export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** The stored hash uses weaker parameters than today's: rehash after a successful sign-in. */
export const needsRehash = (stored: string): boolean => stored.split("$").slice(1, 4).join("$") !== `${COST.N}$${COST.r}$${COST.p}`;

// Verified when the email is unknown, so "no such account" costs the same time as "wrong password" (no user
// enumeration through response timing).
let dummy: Promise<string> | undefined;
export const dummyHash = (): Promise<string> => (dummy ??= hashPassword("rivet-dev-unused-password"));
