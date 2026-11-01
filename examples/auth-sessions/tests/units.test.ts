// Server modules on an in-memory database: hashing, tokens, sliding expiry, reset tokens, the limiter.
import { test } from "vitest";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { resetOrigin } from "../src/server/auth.server.ts";
import { openDb } from "../src/server/db.server.ts";
import { hashPassword, needsRehash, verifyPassword } from "../src/server/password.server.ts";
import { failures, recordFailure, retryAfter } from "../src/server/rate-limit.server.ts";
import { createSession, deleteUserSessions, hashToken, listSessions, SESSION_TTL, validateSession } from "../src/server/sessions.server.ts";
import { consumeResetToken, createResetToken, createUser, RESET_TTL, resetTokenValid } from "../src/server/users.server.ts";

const migrations = fileURLToPath(new URL("../migrations", import.meta.url));
const DAY = 86_400_000;

test("scrypt hashes: per-user salt, verify, malformed hashes never match, rehash on weaker parameters", async () => {
  const a = await hashPassword("correct horse battery");
  const b = await hashPassword("correct horse battery");
  assert.notEqual(a, b);
  assert.match(a, /^scrypt\$16384\$8\$5\$[\w-]{22}\$[\w-]{86}$/);
  assert.equal(await verifyPassword(a, "correct horse battery"), true);
  assert.equal(await verifyPassword(a, "correct horse batterY"), false);
  assert.equal(await verifyPassword("plain-text", "plain-text"), false);
  assert.equal(await verifyPassword(a.slice(0, -4), "correct horse battery"), false);
  assert.equal(needsRehash(a), false);
  assert.equal(needsRehash(a.replace("$16384$", "$1024$")), true);
});

test("sessions store only the token hash; sliding expiry renews in the last 15 days; expired rows go", () => {
  const db = openDb(":memory:", migrations);
  const userId = createUser(db, { email: "A@Example.com", name: "A", passwordHash: "x" })!;
  assert.equal(createUser(db, { email: "a@example.com", name: "dup", passwordHash: "x" }), null);
  const t0 = 1_800_000_000_000;
  const { token, session } = createSession(db, userId, { userAgent: "ua", ip: "1.2.3.4" }, t0);
  assert.match(token, /^[\w-]{43}$/);
  const row = db.prepare("SELECT token_hash FROM sessions").get() as { token_hash: string };
  assert.equal(row.token_hash, hashToken(token));
  assert.notEqual(row.token_hash, token);
  assert.equal(session.expiresAt, t0 + SESSION_TTL);
  assert.equal(validateSession(db, token, t0 + 10 * DAY)?.renewed, false);
  const renewed = validateSession(db, token, t0 + 20 * DAY)!;
  assert.equal(renewed.renewed, true);
  assert.equal(renewed.session.expiresAt, t0 + 20 * DAY + SESSION_TTL);
  assert.equal(validateSession(db, "x".repeat(43), t0), null);
  assert.equal(validateSession(db, "short", t0), null);
  assert.equal(validateSession(db, token, t0 + 51 * DAY), null);
  assert.equal(listSessions(db, userId, t0).length, 0);
  const s1 = createSession(db, userId, {}, t0).session;
  createSession(db, userId, {}, t0);
  assert.equal(deleteUserSessions(db, userId, s1.id), 1);
  assert.deepEqual(
    listSessions(db, userId, t0).map((s) => s.id),
    [s1.id],
  );
});

test("reset tokens: hashed, single use, expire, a new one replaces the old", () => {
  const db = openDb(":memory:", migrations);
  const userId = createUser(db, { email: "r@example.com", name: "R", passwordHash: "x" })!;
  const t0 = 1_800_000_000_000;
  const first = createResetToken(db, userId, t0);
  const second = createResetToken(db, userId, t0);
  assert.equal(resetTokenValid(db, first, t0), false);
  assert.equal(resetTokenValid(db, second, t0), true);
  assert.equal(consumeResetToken(db, second, t0 + RESET_TTL), null, "expired");
  const third = createResetToken(db, userId, t0);
  assert.equal(consumeResetToken(db, third, t0 + 1000), userId);
  assert.equal(consumeResetToken(db, third, t0 + 2000), null, "used");
  assert.equal(consumeResetToken(db, "../../etc", t0), null);
});

test("limiter: sliding 15-minute window per key", () => {
  failures.clear();
  const t0 = 1_800_000_000_000;
  for (let i = 0; i < 5; i++) recordFailure("account:x", t0 + i * 1000);
  assert.equal(retryAfter("account:x", 6, t0 + 5000), 0);
  assert.equal(retryAfter("account:x", 5, t0 + 5000), 15 * 60 - 5);
  assert.equal(retryAfter("account:x", 5, t0 + 15 * 60 * 1000 + 1), 0);
  failures.clear();
});

test("reset links: APP_ORIGIN wins; production never builds one from the request Host", () => {
  const spoofed = { url: new URL("http://evil.example/reset") };
  assert.equal(resetOrigin(spoofed, { APP_ORIGIN: "https://app.example", NODE_ENV: "production" }), "https://app.example");
  assert.throws(() => resetOrigin(spoofed, { NODE_ENV: "production" }), /APP_ORIGIN must be set/);
  assert.equal(resetOrigin(spoofed, { NODE_ENV: "development" }), "http://evil.example");
});
