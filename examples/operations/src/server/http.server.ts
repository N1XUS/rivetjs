import { Fault, requireUser, createSession, revokeSession, authenticate, nextPath } from "./service.server.ts";
import { redirect, type RequestEvent } from "@rivetjs/router";
export const COOKIE = "case-session";
export const userOf = (event: RequestEvent) => requireUser(event.cookies.get(COOKIE));
export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "cache-control": "private, no-store", vary: "Cookie", "x-content-type-options": "nosniff" } });
export async function answer(fn: () => unknown | Promise<unknown>): Promise<Response> {
  try {
    const value = await fn();
    return value instanceof Response ? value : json(value);
  } catch (e) {
    if (e instanceof Fault) return json({ error: e.message }, e.status);
    if (e instanceof SyntaxError) return json({ error: "Malformed request" }, 400);
    throw e;
  }
}
export async function login(event: RequestEvent, email: string, password: string) {
  const user = authenticate(email, password);
  if (!user) throw new Fault(401, "Wrong email or password");
  revokeSession(event.cookies.get(COOKIE));
  const token = createSession(user);
  event.cookies.set(COOKIE, token, { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 3600 });
  return user;
}
export function logout(event: RequestEvent) {
  revokeSession(event.cookies.get(COOKIE));
  event.cookies.delete(COOKIE, { path: "/" });
}
export function loginRedirect(value: string | null) {
  return redirect(nextPath(value), 303);
}
