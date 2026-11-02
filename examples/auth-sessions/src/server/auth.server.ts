// Action bodies of the account forms. Each returns what a forms `action(...)` handler may return: `invalid(...)`
// (re-renders the form with the issue, with or without JavaScript) or a 303 `redirect(...)`.
import { redirect, safeRedirect, type RequestEvent } from "@rivetjs/router";
import { invalid } from "@rivetjs/forms/server";
import { getDb } from "./db.server.ts";
import { sendMail } from "./mail.server.ts";
import { dummyHash, hashPassword, needsRehash, verifyPassword } from "./password.server.ts";
import { clearFailures, limits, recordFailure, retryAfter } from "./rate-limit.server.ts";
import { authOf, deleteUserSessions, startSession } from "./sessions.server.ts";
import { consumeResetToken, createResetToken, createUser, findUserByEmail, getUser, resetTokenValid, setPasswordHash } from "./users.server.ts";

const WRONG = "Wrong email or password";

/** Limiter key of the client address. Without `trustProxy` the node adapter reports the socket address. */
const ipKey = (event: RequestEvent) => `ip:${event.platform.clientAddress ?? "unknown"}`;

/** 429 with `Retry-After` when `key` is over `max` in the window, else undefined. */
function limited(event: RequestEvent, key: string, max: number, what: string) {
  const wait = retryAfter(key, max);
  if (!wait) return undefined;
  event.setHeader("retry-after", String(wait));
  return invalid({}, `Too many ${what}. Try again in ${Math.ceil(wait / 60)} minutes.`, 429);
}

/** Rate-limited sign-in: per client address and per account, checked before any hashing work. */
export async function signIn({ email, password, next }: { email: string; password: string; next: string }, event: RequestEvent) {
  // Without `trustProxy` the node adapter reports the socket address; behind a proxy configure it, or every client
  // shares the proxy's address (and its limit).
  const ip = ipKey(event);
  const account = `account:${email}`;
  const max = limits();
  const wait = Math.max(retryAfter(ip, max.ip), retryAfter(account, max.account));
  if (wait) {
    event.setHeader("retry-after", String(wait));
    return invalid({}, `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minutes.`, 429);
  }
  const user = findUserByEmail(getDb(), email);
  // Unknown email: verify against a dummy hash anyway, so both failures take the same time.
  const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash()), password);
  if (!user || !ok) {
    recordFailure(ip);
    recordFailure(account);
    return invalid({}, WRONG);
  }
  clearFailures(account);
  if (needsRehash(user.passwordHash)) setPasswordHash(getDb(), user.id, await hashPassword(password));
  startSession(event, user.id);
  return redirect(safeRedirect(next, "/account"), 303);
}

/** Sign-up: every attempt counts against the client address (each one costs a full scrypt run), checked before hashing. */
export async function signUp({ name, email, password, next }: { name: string; email: string; password: string; next: string }, event: RequestEvent) {
  const key = `signup:${ipKey(event)}`;
  const over = limited(event, key, limits().signup, "sign-ups from this address");
  if (over) return over;
  recordFailure(key);
  const id = createUser(getDb(), { name, email, passwordHash: await hashPassword(password) });
  // Telling a visitor an email is registered is a deliberate usability trade-off (README: "Account enumeration").
  if (id === null) return invalid({ email: "An account with this email already exists" });
  startSession(event, id);
  return redirect(safeRedirect(next, "/account?done=welcome"), 303);
}

/** Password change: re-authenticates, ends every other session, rotates the current one. */
export async function changePassword({ current, password }: { current: string; password: string }, event: RequestEvent) {
  const auth = authOf(event)!;
  const user = getUser(getDb(), auth.user.id)!;
  if (!(await verifyPassword(user.passwordHash, current))) return invalid({ current: "Your current password is not correct" });
  setPasswordHash(getDb(), user.id, await hashPassword(password));
  deleteUserSessions(getDb(), user.id, auth.session.id);
  startSession(event, user.id);
  return redirect("/account?done=password", 303);
}

/**
 * Origin for links in mails: `APP_ORIGIN`. Production refuses to build one from the request (`Host` is client input:
 * a spoofed Host would put the attacker's site in front of a valid token); development falls back to the request URL.
 */
export function resetOrigin(event: Pick<RequestEvent, "url">, env: Readonly<Record<string, string | undefined>>): string {
  if (env.APP_ORIGIN) return env.APP_ORIGIN;
  if (env.NODE_ENV === "production") throw new Error("APP_ORIGIN must be set in production: reset links never use the request Host");
  return event.url.origin;
}

/**
 * Reset request: always the same answer, whether the account exists or not. At most 3 mails per email per 15 minutes
 * (a reset form must not become a way to flood someone's inbox).
 */
export function requestReset({ email }: { email: string }, event: RequestEvent) {
  const user = findUserByEmail(getDb(), email);
  const key = `reset:${email}`;
  if (user && !retryAfter(key, limits().reset)) {
    recordFailure(key);
    const token = createResetToken(getDb(), user.id);
    const origin = resetOrigin(event, process.env);
    sendMail({
      to: user.email,
      subject: "Reset your password",
      text: `Open this link within 30 minutes to choose a new password:\n${origin}/reset/confirm?token=${token}\nIf you did not ask for it, ignore this mail.`,
    });
  }
  return redirect("/reset?sent=1", 303);
}

/**
 * Reset confirm: consumes the token (single use), sets the password, ends every session, signs in afresh. The token is
 * checked before any hashing work, and invalid tokens count against the client address: random tokens never buy a
 * scrypt run.
 */
export async function confirmReset({ resetId: token, password }: { resetId: string; password: string }, event: RequestEvent) {
  const key = `confirm:${ipKey(event)}`;
  const over = limited(event, key, limits().confirm, "reset attempts");
  if (over) return over;
  const INVALID = "This reset link is invalid, used or expired. Ask for a new one.";
  if (!resetTokenValid(getDb(), token)) {
    recordFailure(key);
    return invalid({}, INVALID);
  }
  const passwordHash = await hashPassword(password);
  // Consumed after hashing: a concurrent use of the same token between the check and here still loses (single use).
  const userId = consumeResetToken(getDb(), token);
  if (userId === null) return invalid({}, INVALID);
  setPasswordHash(getDb(), userId, passwordHash);
  deleteUserSessions(getDb(), userId);
  startSession(event, userId);
  return redirect("/account?done=reset", 303);
}
