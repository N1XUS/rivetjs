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
/** JSON request body that must be an object (`null`, arrays and scalars are a 400, not a TypeError → 500). */
export async function objectBody(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Fault(400, "Object required");
  return value as Record<string, unknown>;
}
export async function login(event: RequestEvent, email: string, password: string) {
  const user = authenticate(email, password);
  if (!user) throw new Fault(401, "Wrong email or password");
  revokeSession(event.cookies.get(COOKIE));
  const token = createSession(user);
  // `Secure` whenever the app is served over HTTPS; the loopback HTTP fixture (tests) gets a plain cookie.
  event.cookies.set(COOKIE, token, { httpOnly: true, secure: event.url.protocol === "https:", sameSite: "lax", path: "/", maxAge: 3600 });
  return user;
}
export function logout(event: RequestEvent) {
  revokeSession(event.cookies.get(COOKIE));
  event.cookies.delete(COOKIE, { path: "/" });
}
export function loginRedirect(value: string | null) {
  return redirect(nextPath(value), 303);
}
