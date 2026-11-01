// Accounts and password reset tokens.
import type { DatabaseSync } from "node:sqlite";
import { hashToken, newToken } from "./sessions.server.ts";

export const RESET_TTL = 30 * 60 * 1000;

export interface UserRow {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
}
const COLUMNS = "id, email, name, password_hash AS passwordHash";

export const findUserByEmail = (db: DatabaseSync, email: string): UserRow | undefined =>
  db.prepare(`SELECT ${COLUMNS} FROM users WHERE email = ?`).get(email.trim().toLowerCase()) as UserRow | undefined;

export const getUser = (db: DatabaseSync, id: number): UserRow | undefined =>
  db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(id) as UserRow | undefined;

/** The new user's id, or null when the email is taken (the UNIQUE constraint decides, so two racing sign-ups cannot both win). */
export function createUser(db: DatabaseSync, input: { email: string; name: string; passwordHash: string }, now = Date.now()): number | null {
  try {
    return Number(
      db
        .prepare("INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)")
        .run(input.email.trim().toLowerCase(), input.name, input.passwordHash, now).lastInsertRowid,
    );
  } catch (error) {
    if (String((error as Error).message).includes("UNIQUE")) return null;
    throw error;
  }
}

export const setPasswordHash = (db: DatabaseSync, userId: number, passwordHash: string): void => {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
};

/** A reset token for the user (only its hash is stored); earlier unused tokens of the user stop working. */
export function createResetToken(db: DatabaseSync, userId: number, now = Date.now()): string {
  const token = newToken();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId);
    db.prepare("INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
      hashToken(token),
      userId,
      now,
      now + RESET_TTL,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return token;
}

const wellFormed = (token: string) => /^[\w-]{43}$/.test(token);

/** The token is unused and not expired (the confirm page shows its form only then). Does not consume it. */
export const resetTokenValid = (db: DatabaseSync, token: string, now = Date.now()): boolean =>
  wellFormed(token) &&
  db.prepare("SELECT 1 FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?").get(hashToken(token), now) !== undefined;

/** Marks the token used and returns its user, in one statement: two concurrent submits cannot both consume it. */
export function consumeResetToken(db: DatabaseSync, token: string, now = Date.now()): number | null {
  if (!wellFormed(token)) return null;
  const row = db
    .prepare("UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id")
    .get(now, hashToken(token), now) as { user_id: number } | undefined;
  return row ? row.user_id : null;
}
