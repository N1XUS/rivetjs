// Client `routeData` on the data endpoint's envelopes: `{ redirect }` navigates (in-app for the same
// origin, `location.assign` otherwise), `{ reload }` loads the target document. No browser: globals stubbed.
import { test } from "vitest";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { encodeData } from "../server/handler.ts";

const assigned: string[] = [];
let answer: unknown;
const g = globalThis as Record<string, unknown>;
g.location = { href: "http://x.test/from", origin: "http://x.test", pathname: "/from", search: "", assign: (href: string) => assigned.push(href) };
g.history = { state: null, replaceState: () => {} };
// The router's failed-navigation fallback listens on the window from the first navigation.
g.addEventListener = () => {};
g.fetch = async () => new Response(encodeData(answer), { headers: { "content-type": "application/json" } });
// `<Link>` is JSX (compiled by the build); routeData does not need it.
registerHooks({
  resolve: (specifier, context, next) =>
    specifier === "./link.tsx" && context.parentURL?.endsWith("/client/index.ts")
      ? { url: "data:text/javascript,export const Link = () => null;", shortCircuit: true }
      : next(specifier, context),
});
const { routeData } = await import("../client/index.ts");

const work = { signal: new AbortController().signal, get: () => undefined } as never;
const settled = (promise: Promise<unknown>) => Promise.race([promise.then(() => "settled"), new Promise((done) => setTimeout(() => done("pending"), 20))]);

test("{ redirect } same origin: in-app replace navigation; other origin: location.assign", async () => {
  const navigated: { to: string; replace?: boolean }[] = [];
  const router = { navigate: (to: string | URL, options?: { replace?: boolean }) => void navigated.push({ to: String(to), ...options }) };
  answer = { redirect: "/login?next=/a", status: 302 };
  assert.equal(await settled(routeData(work, { url: new URL("http://x.test/a") }, router)), "pending");
  assert.deepEqual(navigated, [{ to: "http://x.test/login?next=/a", replace: true }]);
  answer = { redirect: "https://sso.example/auth", status: 302 };
  assert.equal(await settled(routeData(work, { url: new URL("http://x.test/a") }, router)), "pending");
  assert.deepEqual(assigned, ["https://sso.example/auth"]);
  assert.equal(navigated.length, 1);
});

test("{ reload } loads the target document with location.assign", async () => {
  assigned.length = 0;
  answer = { reload: true };
  assert.equal(
    await settled(routeData(work, { url: new URL("http://x.test/report?id=1") }, { navigate: () => assert.fail("no in-app navigation") })),
    "pending",
  );
  assert.deepEqual(assigned, ["http://x.test/report?id=1"]);
});
