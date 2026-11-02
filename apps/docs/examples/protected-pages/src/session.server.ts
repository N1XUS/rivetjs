// Server-only. A real app stores sessions in a database or a signed cookie.
import { randomBytes } from "node:crypto";
import type { Cookies } from "@rivetjs/router";

export interface User {
  name: string;
}

const TTL = 60 * 60 * 8; // seconds, the cookie's maxAge too
// Bounded: expired entries go on every sign-in, and past MAX the oldest go.
const MAX = 10_000;
const sessions = new Map<string, { user: User; expires: number }>();

export function signIn(cookies: Cookies, user: User): void {
  const now = Date.now();
  for (const [id, session] of sessions) if (session.expires <= now) sessions.delete(id);
  while (sessions.size >= MAX) sessions.delete(sessions.keys().next().value!);
  const id = randomBytes(32).toString("base64url");
  sessions.set(id, { user, expires: now + TTL * 1000 });
  cookies.set("session", id, { maxAge: TTL });
}

export function userFrom(cookies: Cookies): User | null {
  const id = cookies.get("session");
  const session = id ? sessions.get(id) : undefined;
  return session && session.expires > Date.now() ? session.user : null;
}

export function signOut(cookies: Cookies): void {
  const id = cookies.get("session");
  if (id) sessions.delete(id);
  cookies.delete("session");
}
