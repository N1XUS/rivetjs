// Database sessions (the Lucia v3 recipe, written out): the cookie carries a random 256-bit token, the `sessions` table
// its SHA-256. Sliding expiry: a session used in the last 15 of its 30 days is extended. Rotation: signing in, signing up,
// a password change and a password reset each end the old session and start a new one (no session fixation).
import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { RequestEvent } from "@rivetjs/router";
import { getDb } from "./db.server.ts";

const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL = 30 * DAY;
/** Extend a session once less than this is left (at most one write per request that crosses it). */
const RENEW_WITHIN = 15 * DAY;
/** `last_seen_at` is written at most once a minute per session. */
const SEEN_EVERY = 60 * 1000;

export interface User {
  id: number;
  email: string;
  name: string;
}
export interface Session {
  id: number;
  userId: number;
  expiresAt: number;
}
/** What the root layout guard puts on `event.locals.auth`: the signed-in user and their session, or null. */
export interface Auth {
  user: User;
  session: Session;
}

/**
 * `__Host-session`: Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain (the prefix makes browsers enforce the last
 * three). Chromium and Firefox accept Secure cookies from http://localhost / 127.0.0.1 (loopback counts as a secure
 * context), so development and the tests use the production cookie. Safari does not: `SESSION_COOKIE_INSECURE=1` switches
 * to a plain `session` cookie without Secure, and is refused in production.
 */
export function cookieName(): { name: string; secure: boolean } {
  if (process.env.SESSION_COOKIE_INSECURE !== "1") return { name: "__Host-session", secure: true };
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_COOKIE_INSECURE=1 is for local development only");
  return { name: "session", secure: false };
}

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
/** 32 random bytes, base64url (43 characters). */
export const newToken = (): string => randomBytes(32).toString("base64url");

export function createSession(db: DatabaseSync, userId: number, client: { userAgent?: string; ip?: string } = {}, now = Date.now()) {
  const token = newToken();
  const expiresAt = now + SESSION_TTL;
  const row = db
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(hashToken(token), userId, now, now, expiresAt, (client.userAgent ?? "").slice(0, 200), client.ip ?? "");
  return { token, session: { id: Number(row.lastInsertRowid), userId, expiresAt } satisfies Session };
}

type Row = { id: number; user_id: number; expires_at: number; last_seen_at: number; email: string; name: string };

/** The session of `token` (expired ones are deleted); `renewed` when its expiry moved and the cookie must be set again. */
export function validateSession(db: DatabaseSync, token: string, now = Date.now()): (Auth & { renewed: boolean }) | null {
  // A cookie we never issued is not worth a query (and keeps junk out of the hash index lookups).
  if (!/^[\w-]{43}$/.test(token)) return null;
  const hash = hashToken(token);
  const row = db
    .prepare("SELECT s.id, s.user_id, s.expires_at, s.last_seen_at, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?")
    .get(hash) as Row | undefined;
  if (!row) return null;
  if (now >= row.expires_at) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.id);
    return null;
  }
  let expiresAt = row.expires_at;
  const renewed = expiresAt - now < RENEW_WITHIN;
  if (renewed) expiresAt = now + SESSION_TTL;
  if (renewed || now - row.last_seen_at >= SEEN_EVERY)
    db.prepare("UPDATE sessions SET expires_at = ?, last_seen_at = ? WHERE id = ?").run(expiresAt, now, row.id);
  return { user: { id: row.user_id, email: row.email, name: row.name }, session: { id: row.id, userId: row.user_id, expiresAt }, renewed };
}

export interface SessionInfo {
  id: number;
  createdAt: number;
  lastSeenAt: number;
  userAgent: string;
  ip: string;
}
export function listSessions(db: DatabaseSync, userId: number, now = Date.now()): SessionInfo[] {
  return db
    .prepare(
      "SELECT id, created_at AS createdAt, last_seen_at AS lastSeenAt, user_agent AS userAgent, ip FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen_at DESC",
    )
    .all(userId, now) as unknown as SessionInfo[];
}

/** Ends one of the user's sessions (another user's id does nothing). */
export const deleteSession = (db: DatabaseSync, userId: number, id: number): boolean =>
  Number(db.prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?").run(id, userId).changes) > 0;

/** Ends every session of the user except `keep` (all of them without it); returns how many ended. */
export const deleteUserSessions = (db: DatabaseSync, userId: number, keep?: number): number =>
  Number(db.prepare("DELETE FROM sessions WHERE user_id = ? AND id IS NOT ?").run(userId, keep ?? null).changes);

/** Housekeeping: drop expired sessions and used / expired reset tokens (`readSession` runs it at most hourly). */
export function deleteExpired(db: DatabaseSync, now = Date.now()): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  db.prepare("DELETE FROM password_resets WHERE expires_at <= ? OR used_at IS NOT NULL").run(now);
}

// --- request glue -------------------------------------------------------------------------------------------------

/** The signed-in user of this request (set by the root layout guard), or null. */
export const authOf = (event: RequestEvent): Auth | null => (event.locals.auth as Auth | null | undefined) ?? null;

function setCookie(event: RequestEvent, token: string, expiresAt: number) {
  const { name, secure } = cookieName();
  event.cookies.set(name, token, { path: "/", httpOnly: true, secure, sameSite: "lax", maxAge: Math.floor((expiresAt - Date.now()) / 1000) });
}
function clearCookie(event: RequestEvent) {
  event.cookies.delete(cookieName().name, { path: "/" });
}

/**
 * Root layout guard body: reads the cookie, validates (sliding expiry), puts `Auth` on `locals.auth`. An unknown or
 * expired token clears the cookie. Pages of a signed-in user are never stored by caches (`Cache-Control: no-store`).
 */
let swept = 0;
export function readSession(event: RequestEvent): void {
  const now = Date.now();
  if (now - swept > 60 * 60 * 1000) deleteExpired(getDb(), (swept = now));
  const token = event.cookies.get(cookieName().name);
  const found = token ? validateSession(getDb(), token) : null;
  event.locals.auth = found && { user: found.user, session: found.session };
  if (token && !found) clearCookie(event);
  if (found) {
    event.setHeader("cache-control", "no-store");
    if (found.renewed) setCookie(event, token!, found.session.expiresAt);
  }
}

/** Signs `userId` in: ends the request's current session (rotation), creates a new one, sets the cookie. */
export function startSession(event: RequestEvent, userId: number): void {
  const db = getDb();
  const current = authOf(event);
  if (current) deleteSession(db, current.session.userId, current.session.id);
  const { token, session } = createSession(db, userId, { userAgent: event.request.headers.get("user-agent") ?? "", ip: event.platform.clientAddress });
  setCookie(event, token, session.expiresAt);
}

/** Signs out: deletes the session row and the cookie. */
export function endSession(event: RequestEvent): void {
  const current = authOf(event);
  if (current) deleteSession(getDb(), current.session.userId, current.session.id);
  event.locals.auth = null;
  clearCookie(event);
}
