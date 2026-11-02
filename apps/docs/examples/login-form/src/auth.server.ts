// Server-only (`.server.ts`): the build refuses to put this file in browser code.
// A real app keeps users and sessions in a database; this demo keeps them in memory.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Cookies } from "@rivetjs/router";

const hash = (password: string, salt: Buffer) => scryptSync(password, salt, 64);

// One demo user. Store only a salted hash, never the password itself.
const salt = randomBytes(16);
const users = new Map([["demo@example.com", { name: "Demo user", salt, hash: hash("rivet-demo", salt) }]]);

/** The user's name when the email and password match, else null. */
export function checkPassword(email: string, password: string): string | null {
  const user = users.get(email.trim().toLowerCase());
  if (!user) return null;
  // Compare in constant time, so response times do not leak how much matched.
  return timingSafeEqual(hash(password, user.salt), user.hash) ? user.name : null;
}

const SESSION = "session";
const TTL = 60 * 60 * 24 * 7; // seconds, the cookie's maxAge too
// Session id → user name and expiry. Bounded: expired entries go on every sign-in, and past MAX the oldest go.
const MAX = 10_000;
const sessions = new Map<string, { name: string; expires: number }>();

export function startSession(cookies: Cookies, name: string): void {
  const now = Date.now();
  for (const [id, session] of sessions) if (session.expires <= now) sessions.delete(id);
  while (sessions.size >= MAX) sessions.delete(sessions.keys().next().value!);
  const id = randomBytes(32).toString("base64url");
  sessions.set(id, { name, expires: now + TTL * 1000 });
  // Rivet cookies are HttpOnly, Secure and SameSite=Lax unless you say otherwise.
  cookies.set(SESSION, id, { maxAge: TTL });
}

export function currentUser(cookies: Cookies): string | null {
  const id = cookies.get(SESSION);
  const session = id ? sessions.get(id) : undefined;
  return session && session.expires > Date.now() ? session.name : null;
}

export function endSession(cookies: Cookies): void {
  const id = cookies.get(SESSION);
  if (id) sessions.delete(id);
  cookies.delete(SESSION);
}
