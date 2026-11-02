// The docs examples' in-memory session stores (login-form, guard-login, protected-pages) honour the cookie's
// lifetime on the server too, and drop expired entries on the next sign-in, so the maps stay bounded.
import { strict as assert } from "node:assert";
import type { Cookies } from "@rivetjs/router";
import { afterEach, test, vi } from "vitest";
import { currentUser, startSession } from "../examples/login-form/src/auth.server.ts";
import { createSession, userFor } from "../examples/guard-login/src/sessions.server.ts";
import { signIn, userFrom } from "../examples/protected-pages/src/session.server.ts";

const HOUR = 3_600_000;
const jar = () => {
  const values = new Map<string, string>();
  return { get: (name: string) => values.get(name), set: (name: string, value: string) => void values.set(name, value), delete: (name: string) => void values.delete(name) } as unknown as Cookies;
};
afterEach(() => vi.useRealTimers());

test("login-form: a session ends with its 7-day cookie", () => {
  vi.useFakeTimers({ now: 1_800_000_000_000 });
  const cookies = jar();
  startSession(cookies, "Ada");
  assert.equal(currentUser(cookies), "Ada");
  vi.setSystemTime(Date.now() + 7 * 24 * HOUR + 1);
  assert.equal(currentUser(cookies), null);
});

test("guard-login: a session ends with its 1-hour cookie", () => {
  vi.useFakeTimers({ now: 1_800_000_000_000 });
  const id = createSession("Grace");
  assert.equal(userFor(id), "Grace");
  vi.setSystemTime(Date.now() + HOUR + 1);
  assert.equal(userFor(id), undefined);
});

test("protected-pages: a session ends with its 8-hour cookie", () => {
  vi.useFakeTimers({ now: 1_800_000_000_000 });
  const cookies = jar();
  signIn(cookies, { name: "Linus" });
  assert.deepEqual(userFrom(cookies), { name: "Linus" });
  vi.setSystemTime(Date.now() + 8 * HOUR + 1);
  assert.equal(userFrom(cookies), null);
});
