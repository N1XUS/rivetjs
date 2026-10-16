// Server-only. A real app stores sessions in a database or a signed cookie.
import { randomBytes } from "node:crypto";
import type { Cookies } from "@rivetjs/router";

export interface User {
  name: string;
}

const sessions = new Map<string, User>();

export function signIn(cookies: Cookies, user: User): void {
  const id = randomBytes(32).toString("base64url");
  sessions.set(id, user);
  cookies.set("session", id, { maxAge: 60 * 60 * 8 });
}

export function userFrom(cookies: Cookies): User | null {
  const id = cookies.get("session");
  return (id && sessions.get(id)) || null;
}

export function signOut(cookies: Cookies): void {
  const id = cookies.get("session");
  if (id) sessions.delete(id);
  cookies.delete("session");
}
