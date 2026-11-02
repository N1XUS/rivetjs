// Production build + server on 127.0.0.1:4475 with a fresh SQLite file: JS-off flows and security properties over
// fetch (cookie flags, rotation, sessions, reset tokens, rate limits, open redirects, CSRF), then Chromium with and
// without JavaScript.
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { brotliCompressSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const cwd = process.cwd();
const PORT = 4475;
const base = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), "rivet-auth-sessions-"));
const dbPath = join(dir, "auth.db");
const PASSWORD = "rivet-dev-password-1";
let serving: { close(): Promise<unknown> } | undefined;
let db: DatabaseSync;
let jsBytes = 0;
const ENV = { DATABASE_PATH: dbPath, MAIL_LOG: "0", RATE_LIMIT_IP: "1000", RATE_LIMIT_SIGNUP: "1000", RATE_LIMIT_CONFIRM: "1000", APP_ORIGIN: base };
const savedEnv: Record<string, string | undefined> = {};

type Mail = { to: string; text: string };
const outbox = () => ((globalThis as Record<symbol, Mail[] | undefined>)[Symbol.for("rivet.example.auth-sessions.outbox")] ??= []);
const failures = () => (globalThis as Record<symbol, Map<string, number[]> | undefined>)[Symbol.for("rivet.example.auth-sessions.limits")];

beforeAll(async () => {
  const bin = ["node_modules/vite/bin/vite.js", "../../node_modules/vite/bin/vite.js"].map((p) => join(root, p)).find(existsSync)!;
  for (const args of [["build"], ["build", "--ssr"]])
    execFileSync(process.execPath, [bin, ...args], { cwd: root, stdio: "pipe", env: { ...process.env, NODE_ENV: "production" } });
  for (const [key, value] of Object.entries(ENV)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
  process.chdir(root);
  const { start } = await import("@rivetjs/router/node");
  serving = await start({ dist: join(root, "dist"), port: PORT, host: "127.0.0.1" });
  // Every module the sign-in page may load for its first interaction (the loader's `data-fo` preload list), brotli.
  const html = await (await fetch(base + "/signin")).text();
  const fo = /data-fo="([^"]+)"/.exec(html)![1]!.split(" ");
  for (const src of fo) jsBytes += brotliCompressSync(Buffer.from(await (await fetch(base + src)).arrayBuffer())).byteLength;
  db = new DatabaseSync(dbPath);
}, 180_000);
afterAll(async () => {
  db?.close();
  await serving?.close();
  process.chdir(cwd);
  for (const [key, value] of Object.entries(savedEnv)) value === undefined ? delete process.env[key] : (process.env[key] = value);
  rmSync(dir, { recursive: true, force: true });
});

// --- helpers --------------------------------------------------------------------------------------------------------

const html = async (r: Response) => (await r.text()).replace(/<!--.*?-->/g, "");
const sessionCookie = (r: Response) => r.headers.getSetCookie().find((c) => c.startsWith("__Host-session="));
const tokenOf = (r: Response) => /^__Host-session=([^;]*)/.exec(sessionCookie(r) ?? "")?.[1];
const get = (path: string, token?: string) => fetch(base + path, { redirect: "manual", headers: token ? { cookie: `__Host-session=${token}` } : {} });
const post = (path: string, values: Record<string, string>, token?: string, headers: Record<string, string> = {}) =>
  fetch(base + path, {
    method: "POST",
    body: new URLSearchParams(values),
    redirect: "manual",
    headers: { origin: base, ...(token ? { cookie: `__Host-session=${token}` } : {}), ...headers },
  });
let n = 0;
const email = (what: string) => `${what}-${++n}@example.com`;
async function signUp(address = email("user"), password = PASSWORD) {
  const r = await post("/signup?/signup", { name: "Test User", email: address, password, next: "" });
  assert.equal(r.status, 303, await r.clone().text());
  return { email: address, token: tokenOf(r)!, response: r };
}
const signIn = (address: string, password = PASSWORD, extra: Record<string, string> = {}, token?: string) =>
  post("/signin?/signin", { email: address, password, next: "", ...extra }, token);
const signedIn = async (token: string) => (await get("/account", token)).status === 200;

// --- JS-off flows and security over HTTP ------------------------------------------------------------------------------

test("health, anonymous pages, security headers, account requires a session", async () => {
  assert.equal((await fetch(base + "/healthz")).status, 200);
  const home = await get("/");
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.match(home.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.match(await html(home), /id="nav-signin"/);
  const account = await get("/account?done=x");
  assert.equal(account.status, 303);
  assert.equal(account.headers.get("location"), "/signin?next=%2Faccount%3Fdone%3Dx");
});

test("sign up sets a __Host- cookie (Secure, HttpOnly, SameSite=Lax, Path=/, no Domain); the database holds only its hash", async () => {
  const { token, response } = await signUp();
  assert.equal(response.headers.get("location"), "/account?done=welcome");
  const cookie = sessionCookie(response)!;
  assert.match(cookie, /^__Host-session=[\w-]{43}; Path=\/; Max-Age=259\d{4}; HttpOnly; Secure; SameSite=Lax$/);
  assert.doesNotMatch(cookie, /Domain/i);
  const rows = db.prepare("SELECT token_hash FROM sessions").all() as { token_hash: string }[];
  assert.ok(rows.some((r) => r.token_hash === createHash("sha256").update(token).digest("hex")));
  assert.ok(!rows.some((r) => r.token_hash === token));
  const account = await get("/account?done=welcome", token);
  assert.equal(account.status, 200);
  assert.equal(account.headers.get("cache-control"), "no-store");
  const page = await html(account);
  assert.match(page, /Your account is ready/);
  assert.equal([...page.matchAll(/data-session="/g)].length, 1);
  // Signed in: the sign-in and sign-up pages send you on.
  assert.equal((await get("/signin", token)).headers.get("location"), "/account");
});

test("validation: short password, duplicate email; passwords are never echoed", async () => {
  const short = await post("/signup?/signup", { name: "Short", email: email("short"), password: "abc123", next: "" });
  assert.equal(short.status, 400);
  const page = await html(short);
  assert.match(page, /Use at least 10 characters/);
  assert.doesNotMatch(page, /abc123/);
  const { email: taken } = await signUp();
  const dup = await post("/signup?/signup", { name: "Dup", email: taken.toUpperCase(), password: "another-password-9", next: "" });
  assert.equal(dup.status, 400);
  const dupPage = await html(dup);
  assert.match(dupPage, /An account with this email already exists/);
  assert.doesNotMatch(dupPage, /another-password-9/);
});

test("sign in: one message for unknown email and wrong password; rotation drops the previous session", async () => {
  const { email: address, token: first } = await signUp();
  for (const r of [await signIn(address, "wrong-password-0"), await signIn(email("nobody"), "wrong-password-0")]) {
    assert.equal(r.status, 400);
    const page = await html(r);
    assert.match(page, /Wrong email or password/);
    assert.doesNotMatch(page, /wrong-password-0/);
    assert.equal(sessionCookie(r), undefined);
  }
  // Signing in while holding a session cookie: a new token, and the old session no longer exists.
  const again = await signIn(address, PASSWORD, {}, first);
  assert.equal(again.status, 303);
  const second = tokenOf(again)!;
  assert.notEqual(second, first);
  assert.equal(await signedIn(second), true);
  const stale = await get("/account", first);
  assert.equal(stale.status, 303);
  assert.match(sessionCookie(stale) ?? "", /^__Host-session=; Path=\/; Max-Age=0; Expires=Thu, 01 Jan 1970/);
});

test("?next= accepts same-origin paths only (safeRedirect)", async () => {
  const { email: address } = await signUp();
  const cases: [string, string][] = [
    ["/account?done=others", "/account?done=others"],
    ["//evil.example/x", "/account"],
    ["https://evil.example/", "/account"],
    ["/\\evil.example", "/account"],
    ["javascript:alert(1)", "/account"],
    ["/%0d%0aSet-Cookie:x=1", "/%0d%0aSet-Cookie:x=1"],
  ];
  for (const [next, expected] of cases) {
    const r = await signIn(address, PASSWORD, { next });
    assert.equal(r.headers.get("location"), expected, next);
  }
  assert.match(await html(await get("/signin?next=%2F%2Fevil.example")), /name="next" value="\/account"/);
});

test("sessions list: revoke one (own only), sign out other sessions, sign out", async () => {
  const { email: address, token: a } = await signUp();
  const b = tokenOf(await signIn(address))!;
  const c = tokenOf(await signIn(address))!;
  const ids = [...(await html(await get("/account", c))).matchAll(/data-session="(\d+)"/g)].map((m) => m[1]!);
  assert.equal(ids.length, 3);
  // Another user's session id does nothing.
  const { token: stranger } = await signUp();
  const strangerIds = [...(await html(await get("/account", stranger))).matchAll(/data-session="(\d+)"/g)].map((m) => m[1]!);
  assert.equal((await post("/account?/revoke", { id: strangerIds[0]! }, c)).status, 303);
  assert.equal(await signedIn(stranger), true);
  // Revoke the oldest session (a) from c.
  const aId = ids[ids.length - 1]!;
  assert.equal((await post("/account?/revoke", { id: aId }, c)).headers.get("location"), "/account?done=revoked");
  assert.equal(await signedIn(a), false);
  assert.equal(await signedIn(b), true);
  // Sign out the others from c: b ends, c stays.
  assert.equal((await post("/account?/others", {}, c)).headers.get("location"), "/account?done=others");
  assert.equal(await signedIn(b), false);
  assert.equal(await signedIn(c), true);
  // Sign out: cookie deleted, the row gone, the token dead even if replayed.
  const out = await post("/account?/signout", {}, c);
  assert.equal(out.headers.get("location"), "/");
  assert.match(sessionCookie(out) ?? "", /Max-Age=0/);
  assert.equal(await signedIn(c), false);
  // A GET never signs out.
  const d = tokenOf(await signIn(address))!;
  await get("/account?/signout", d);
  assert.equal(await signedIn(d), true);
});

test("sliding expiry: renewed in the last 15 days; expired sessions are rejected and removed", async () => {
  const { token } = await signUp();
  const hash = createHash("sha256").update(token).digest("hex");
  db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(Date.now() + 86_400_000, hash);
  const renewed = await get("/account", token);
  assert.equal(renewed.status, 200);
  assert.match(sessionCookie(renewed) ?? "", /Max-Age=259\d{4}/);
  const { expires_at } = db.prepare("SELECT expires_at FROM sessions WHERE token_hash = ?").get(hash) as { expires_at: number };
  assert.ok(expires_at > Date.now() + 29 * 86_400_000);
  // Not near the end: no new cookie.
  assert.equal(sessionCookie(await get("/account", token)), undefined);
  db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(Date.now() - 1000, hash);
  const expired = await get("/account", token);
  assert.equal(expired.status, 303);
  assert.match(sessionCookie(expired) ?? "", /Max-Age=0/);
  assert.equal(db.prepare("SELECT 1 FROM sessions WHERE token_hash = ?").get(hash), undefined);
});

test("password change re-authenticates, ends other sessions and rotates the current one", async () => {
  const { email: address, token: a } = await signUp();
  const b = tokenOf(await signIn(address))!;
  const wrong = await post("/account?/password", { current: "not-my-password", password: "brand-new-password" }, a);
  assert.equal(wrong.status, 400);
  const wrongPage = await html(wrong);
  assert.match(wrongPage, /Your current password is not correct/);
  assert.doesNotMatch(wrongPage, /not-my-password|brand-new-password/);
  const ok = await post("/account?/password", { current: PASSWORD, password: "brand-new-password" }, a);
  assert.equal(ok.headers.get("location"), "/account?done=password");
  const rotated = tokenOf(ok)!;
  assert.notEqual(rotated, a);
  assert.equal(await signedIn(a), false);
  assert.equal(await signedIn(b), false);
  assert.equal(await signedIn(rotated), true);
  assert.equal((await signIn(address)).status, 400);
  assert.equal((await signIn(address, "brand-new-password")).status, 303);
});

test("password reset: same answer for unknown emails, single-use token, expiry, every session ends", async () => {
  const { email: address, token: before } = await signUp();
  const sent = outbox().length;
  const unknown = await post("/reset?/request", { email: email("ghost") });
  assert.equal(unknown.headers.get("location"), "/reset?sent=1");
  assert.equal(outbox().length, sent);
  const known = await post("/reset?/request", { email: address });
  assert.equal(known.headers.get("location"), "/reset?sent=1");
  const mail = outbox().at(-1)!;
  assert.equal(mail.to, address);
  const link = /http:\/\/127\.0\.0\.1:4475(\/reset\/confirm\?token=([\w-]{43}))/.exec(mail.text)!;
  assert.ok(link);
  const [, path, token] = link;
  assert.equal(db.prepare("SELECT 1 FROM password_resets WHERE token_hash = ?").get(token!), undefined, "only the hash is stored");
  const form = await get(path!);
  assert.equal(form.headers.get("referrer-policy"), "same-origin");
  assert.equal(form.headers.get("cache-control"), "no-store");
  assert.match(await html(form), /id="reset-confirm"/);
  const done = await post(`/reset/confirm?/reset&token=${token}`, { resetId: token!, password: "reset-password-77" });
  assert.equal(done.headers.get("location"), "/account?done=reset");
  assert.equal(await signedIn(before), false);
  assert.equal(await signedIn(tokenOf(done)!), true);
  assert.equal((await signIn(address, "reset-password-77")).status, 303);
  // Used: the page and the action refuse it.
  assert.match(await html(await get(path!)), /id="reset-invalid"/);
  const reused = await post(`/reset/confirm?/reset&token=${token}`, { resetId: token!, password: "another-password-88" });
  assert.equal(reused.status, 400);
  assert.match(await html(reused), /invalid, used or expired/);
  // Expired.
  await post("/reset?/request", { email: address });
  const fresh = /token=([\w-]{43})/.exec(outbox().at(-1)!.text)![1]!;
  db.prepare("UPDATE password_resets SET expires_at = ?").run(Date.now() - 1);
  assert.equal((await post(`/reset/confirm?/reset&token=${fresh}`, { resetId: fresh, password: "another-password-88" })).status, 400);
  // At most 3 mails per email per 15 minutes (two sent above).
  const count = outbox().length;
  for (let i = 0; i < 3; i++) await post("/reset?/request", { email: address });
  assert.equal(outbox().length, count + 1);
});

test("login rate limit: per account (5 failures) and per client address", async () => {
  failures()?.clear();
  const { email: address } = await signUp();
  for (let i = 0; i < 5; i++) assert.equal((await signIn(address, "wrong-password-x")).status, 400);
  const blocked = await signIn(address, PASSWORD);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 800);
  assert.match(await html(blocked), /Too many sign-in attempts/);
  // Another account from the same address is unaffected by the account limit.
  const { email: other } = await signUp();
  assert.equal((await signIn(other)).status, 303);
  // Address limit: 3 failures across accounts block every account from that address.
  failures()!.clear();
  process.env.RATE_LIMIT_IP = "3";
  try {
    for (let i = 0; i < 3; i++) await signIn(email("spray"), "wrong-password-x");
    assert.equal((await signIn(other)).status, 429);
  } finally {
    process.env.RATE_LIMIT_IP = "1000";
    failures()!.clear();
  }
});

test("hashing work is rate limited: sign-ups per address; invalid reset tokens per address, before any scrypt run", async () => {
  failures()?.clear();
  process.env.RATE_LIMIT_SIGNUP = "2";
  process.env.RATE_LIMIT_CONFIRM = "2";
  try {
    for (let i = 0; i < 2; i++) assert.equal((await signUp()).response.status, 303);
    const third = await post("/signup?/signup", { name: "Spray", email: email("spray"), password: PASSWORD, next: "" });
    assert.equal(third.status, 429);
    assert.ok(Number(third.headers.get("retry-after")) > 800);
    const random = () => "A".repeat(42) + String(++n % 10);
    for (let i = 0; i < 2; i++) assert.equal((await post(`/reset/confirm?/reset`, { resetId: random(), password: "x".repeat(128) })).status, 400);
    const blocked = await post(`/reset/confirm?/reset`, { resetId: random(), password: "x".repeat(128) });
    assert.equal(blocked.status, 429);
    assert.match(await html(blocked), /Too many reset attempts/);
  } finally {
    process.env.RATE_LIMIT_SIGNUP = "1000";
    process.env.RATE_LIMIT_CONFIRM = "1000";
    failures()!.clear();
  }
});

test("CSRF: cross-site posts, and posts without Origin / Sec-Fetch-Site, are refused (403)", async () => {
  const { email: address, token } = await signUp();
  const cross = await post("/signin?/signin", { email: address, password: PASSWORD, next: "" }, undefined, { origin: "http://evil.example" });
  assert.equal(cross.status, 403);
  assert.equal(sessionCookie(cross), undefined);
  const others = await post("/account?/others", {}, token, { origin: "http://evil.example" });
  assert.equal(others.status, 403);
  const bare = await fetch(base + "/account?/signout", {
    method: "POST",
    body: new URLSearchParams(),
    redirect: "manual",
    headers: { cookie: `__Host-session=${token}` },
  });
  assert.equal(bare.status, 403);
  const site = await fetch(base + "/account?/signout", {
    method: "POST",
    body: new URLSearchParams(),
    redirect: "manual",
    headers: { cookie: `__Host-session=${token}`, "sec-fetch-site": "cross-site" },
  });
  assert.equal(site.status, 403);
  assert.equal(await signedIn(token), true);
});

// --- browsers ---------------------------------------------------------------------------------------------------------

async function withBrowser(fn: (browser: Browser) => Promise<void>) {
  const browser = await chromium.launch();
  try {
    await fn(browser);
  } finally {
    await browser.close();
  }
}

test("JavaScript on: client validation, enhanced sign-up / sign-in errors, two devices, sign out others", async () => {
  await withBrowser(async (browser) => {
    const laptop = await browser.newContext();
    const page = await laptop.newPage();
    page.setDefaultTimeout(15_000);
    const address = email("browser");
    await page.goto(base + "/signup");
    await page.locator("#signup-name").fill("Browser User");
    await page.locator("#signup-email").fill(address);
    await page.locator("#signup-password").fill("short");
    await page.locator("#signup-submit").click();
    await page.getByText("Use at least 10 characters").waitFor();
    assert.equal(new URL(page.url()).pathname, "/signup");
    await page.locator("#signup-password").fill(PASSWORD);
    await page.locator("#signup-submit").click();
    await page.locator("#notice").waitFor();
    assert.equal(new URL(page.url()).pathname, "/account");
    const [cookie] = (await laptop.cookies()).filter((c) => c.name === "__Host-session");
    assert.ok(cookie);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, "Lax");
    assert.equal(await page.evaluate(() => document.cookie), "", "HttpOnly: not readable from scripts");

    await page.locator("#signout").click();
    await page.locator("#nav-signin").waitFor();
    await page.goto(base + "/account");
    assert.equal(new URL(page.url()).pathname, "/signin");
    await page.locator("#signin-email").fill(address);
    await page.locator("#signin-password").fill("not-the-password");
    await page.locator("#signin-submit").click();
    await page.getByText("Wrong email or password").waitFor();
    assert.equal(await page.locator("#signin-password").inputValue(), "not-the-password", "enhanced: the typed values stay");
    await page.locator("#signin-password").fill(PASSWORD);
    await page.locator("#signin-submit").click();
    await page.locator("#sessions").waitFor();
    assert.equal(new URL(page.url()).pathname, "/account", "back to ?next=/account");

    // A second device.
    const phone = await browser.newContext({ userAgent: "Phone/1.0" });
    const other = await phone.newPage();
    other.setDefaultTimeout(15_000);
    await other.goto(base + "/signin");
    await other.locator("#signin-email").fill(address);
    await other.locator("#signin-password").fill(PASSWORD);
    await other.locator("#signin-submit").click();
    await other.locator("#sessions").waitFor();

    await page.reload();
    assert.equal(await page.locator("#sessions li").count(), 2);
    await page.getByText("Phone/1.0").waitFor();
    await page.locator("#signout-others").click();
    await page.getByText("Every other session was signed out.").waitFor();
    assert.equal(await page.locator("#sessions li").count(), 1);
    await other.reload();
    assert.equal(new URL(other.url()).pathname, "/signin");
  });
});

test("JavaScript off: sign up, sign in with ?next=, failed sign in, password reset", async () => {
  await withBrowser(async (browser) => {
    const page = await browser.newPage({ javaScriptEnabled: false });
    page.setDefaultTimeout(15_000);
    const address = email("nojs");
    await page.goto(base + "/signup");
    await page.locator("#signup-name").fill("No Script");
    await page.locator("#signup-email").fill(address);
    await page.locator("#signup-password").fill(PASSWORD);
    await page.locator("#signup-submit").click();
    await page.locator("#notice").waitFor();
    await page.locator("#signout").click();
    await page.locator("#nav-signin").waitFor();

    await page.goto(base + "/account?done=others");
    assert.equal(new URL(page.url()).pathname, "/signin");
    await page.locator("#signin-email").fill(address);
    await page.locator("#signin-password").fill("not-the-password");
    await page.locator("#signin-submit").click();
    await page.getByText("Wrong email or password").waitFor();
    assert.equal(await page.locator("#signin-password").inputValue(), "", "never echoed");
    assert.equal(await page.locator("#signin-email").inputValue(), address);
    await page.locator("#signin-password").fill(PASSWORD);
    await page.locator("#signin-submit").click();
    await page.locator("#notice").waitFor();
    assert.equal(new URL(page.url()).search, "?done=others", "next survived the failed attempt");

    await page.locator("#signout").click();
    await page.goto(base + "/reset");
    await page.locator("#reset-email").fill(address);
    await page.locator("#reset-submit").click();
    await page.locator("#reset-sent").waitFor();
    const link = /http:\S+/.exec(outbox().at(-1)!.text)![0];
    await page.goto(link);
    await page.locator("#reset-password").fill("short");
    await page.locator("#reset-confirm").click();
    await page.getByText("Use at least 10 characters").waitFor();
    await page.locator("#reset-password").fill("nojs-reset-password");
    await page.locator("#reset-confirm").click();
    await page.getByText("Your new password is set.").waitFor();
  });
});

test("client JS of the sign-in page stays within budget", async () => {
  // No script runs before input: the page HTML references no script file (the inline loader boots on idle / input).
  assert.doesNotMatch(await (await fetch(base + "/signin")).text(), /<script[^>]*\ssrc=/);
  const budget = 100 * 1024;
  console.log(`sign-in page JS (brotli): ${jsBytes} bytes`);
  assert.ok(jsBytes > 0 && jsBytes <= budget, `${jsBytes} > ${budget}`);
});
