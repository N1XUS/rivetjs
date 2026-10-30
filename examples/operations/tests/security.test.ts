import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import WebSocket from "ws";
import { afterAll, beforeAll, describe, it } from "vitest";
import type { Cart, Order } from "../src/server/service.server.ts";
import { startApp, type AppFixture } from "./_support.ts";

// App-policy labels deliberately identify the example's explicit authorization rules.
// The router runs those guards; it does not infer tenant, role, upload, or upgrade policy.
describe("operations security", { concurrent: false, shuffle: false }, () => {
  let fixture: AppFixture;
  let base: string;
  let alice: Awaited<ReturnType<typeof login>>;
  let bob: Awaited<ReturnType<typeof login>>;
  let viewer: Awaited<ReturnType<typeof login>>;
  let admin: Awaited<ReturnType<typeof login>>;
  beforeAll(async () => {
    fixture = await startApp("security");
    base = fixture.base;
    alice = await login();
    bob = await login("bob@beta.test");
    viewer = await login("viewer@alpha.test");
    admin = await login("admin@alpha.test");
  });
  afterAll(async () => {
    await fixture?.close();
  });
  const send = (path: string, method = "GET", cookie = "", body?: unknown, headers: Record<string, string> = {}) =>
    fetch(base + path, {
      method,
      redirect: "manual",
      headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { origin: base, "content-type": "application/json" }), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
  async function login(email = "alice@alpha.test") {
    const r = await send("/auth/session", "POST", "", { email, password: "demo-pass-2026" });
    assert.equal(r.status, 200);
    assert.match(r.headers.getSetCookie()[0] ?? "", /^case-session=[a-f0-9]{64};/);
    return {
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
      headers: r.headers.getSetCookie(),
    };
  }
  const status = async (path: string, expected: number, method = "GET", cookie = "", body?: unknown, headers: Record<string, string> = {}) => {
    const r = await send(path, method, cookie, body, headers);
    await r.body?.cancel();
    assert.equal(r.status, expected, `${method} ${path}`);
    return { status: r.status };
  };
  async function withTimeout<T>(work: Promise<T>, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), 1500);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  for (const path of ["/desk", "/desk/editor", "/desk/admin", "/desk/api/tickets/alpha-1", "/desk/api/draft", "/desk/api/events", "/store/api/cart"])
    it(`anonymous-denied:${path}` + " [framework-guard]", () => status(path, 401));

  it("login-session-cookie-flags [framework-cookie+app-policy]", async () => {
    for (const flag of ["HttpOnly", "SameSite=Lax", "Path=/"]) assert.ok(alice.headers[0].includes(flag));
    return { flags: ["HttpOnly", "SameSite=Lax", "Path=/"], secureFalseReason: "loopback HTTP fixture only" };
  });
  it("forged-session-rejected [app-policy]", () => status("/desk", 401, "GET", "case-session=" + "a".repeat(64)));
  it("session-not-accepted-from-query-string [app-policy]", () => status("/desk?session=" + alice.cookie.split("=")[1], 401));
  it("wrong-password-and-unknown-user-same-failure [app-policy]", async () => {
    const a = await send("/auth/session", "POST", "", { email: "alice@alpha.test", password: "wrong" }),
      b = await send("/auth/session", "POST", "", { email: "missing@alpha.test", password: "wrong" });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.deepEqual(await a.json(), await b.json());
    return { status: 401 };
  });
  it("sql-injection-login-rejected [app-policy]", () => status("/auth/session", 401, "POST", "", { email: "' OR 1=1--", password: "x" }));
  it("session-rotation-invalidates-previous-cookie [app-policy+framework-cookie]", async () => {
    const old = await login("editor@alpha.test");
    const r = await send("/auth/session", "POST", old.cookie, { email: "editor@alpha.test", password: "demo-pass-2026" });
    assert.equal(r.status, 200);
    assert.notEqual(r.headers.getSetCookie()[0].split(";")[0], old.cookie);
    await status("/auth/session", 401, "GET", old.cookie);
    return { rotated: true, oldRejected: true };
  });
  it("own-tenant-ticket-visible [app-policy]", () => status("/desk/api/tickets/alpha-1", 200, "GET", alice.cookie));
  it("cross-tenant-ticket-IDOR-read [app-policy]", () => status("/desk/api/tickets/alpha-1", 404, "GET", bob.cookie));
  it("cross-tenant-ticket-IDOR-write [app-policy]", () => status("/desk/api/tickets/alpha-1", 404, "PATCH", bob.cookie, { version: 0, title: "stolen" }));
  it("viewer-reads-ticket [app-policy]", () => status("/desk/api/tickets/alpha-1", 200, "GET", viewer.cookie));
  it("viewer-cannot-patch-ticket [app-policy]", () => status("/desk/api/tickets/alpha-1", 403, "PATCH", viewer.cookie, { version: 0, status: "closed" }));
  it("viewer-cannot-post-message [app-policy]", () => status("/desk/api/messages/alpha-1", 403, "POST", viewer.cookie, { body: "no" }));
  it("viewer-cannot-write-draft [app-policy]", () => status("/desk/api/draft", 403, "PUT", viewer.cookie, { version: 0, title: "no", body: "no" }));
  it("agent-cannot-open-admin-page [framework-guard+app-policy]", () => status("/desk/admin", 403, "GET", alice.cookie));
  it("admin-can-open-admin-page [framework-guard+app-policy]", () => status("/desk/admin", 200, "GET", admin.cookie));
  it("mass-assignment-role-and-tenant-rejected [app-policy]", () =>
    status("/desk/api/tickets/alpha-1", 400, "PATCH", alice.cookie, { version: 0, tenant: "beta", role: "admin" }));
  for (const path of ["/desk?_rivet=data", "/desk/editor?_rivet=data&_rivet_keep=/desk", "/desk/admin?_rivet=data&_rivet_keep=/desk"])
    it(`data-endpoint-cannot-skip-auth:${path}` + " [framework-guard]", () => status(path, 401));
  it("kept-layout-data-cannot-skip-role-guard [framework-guard]", () => status("/desk/admin?_rivet=data&_rivet_keep=/desk", 403, "GET", viewer.cookie));
  for (const path of ["/desk", "/desk?_rivet=data", "/desk/api/tickets/alpha-1", "/desk/api/draft", "/store", "/store/cart", "/sign-in"])
    it(`private-no-store:${path}` + " [framework-header+app-policy]", async () => {
      const r = await send(path, "GET", alice.cookie);
      assert.equal(r.status, 200);
      assert.match(r.headers.get("cache-control") ?? "", /no-store/);
      assert.match(r.headers.get("vary") ?? "", /Cookie/i);
      return { cacheControl: r.headers.get("cache-control") };
    });
  for (const origin of ["https://attacker.invalid", "null", "http://127.0.0.1:1"])
    it(`csrf-cross-origin:${origin}` + " [framework-CSRF]", () =>
      status("/desk/api/messages/alpha-1", 403, "POST", alice.cookie, { body: "forbidden" }, { origin }),
    );
  it("csrf-fetch-metadata-cross-site [framework-CSRF]", async () => {
    const r = await fetch(base + "/desk/api/messages/alpha-1", {
      method: "POST",
      headers: { cookie: alice.cookie, "content-type": "application/json", "sec-fetch-site": "cross-site" },
      body: '{"body":"forbidden"}',
    });
    assert.equal(r.status, 403);
    return { status: 403 };
  });
  it("csrf-form-without-origin-or-metadata [framework-CSRF]", async () => {
    const r = await fetch(base + "/sign-in?/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=alice%40alpha.test&password=demo-pass-2026",
    });
    assert.equal(r.status, 403);
    return { status: 403 };
  });
  it("csrf-does-not-trust-forwarded-host [framework-CSRF]", () =>
    status(
      "/desk/api/messages/alpha-1",
      403,
      "POST",
      alice.cookie,
      { body: "forbidden" },
      { origin: "https://attacker.invalid", "x-forwarded-host": "attacker.invalid", "x-forwarded-proto": "https" },
    ));
  it("same-origin-message-write-works [app-policy+framework-CSRF]", () =>
    status("/desk/api/messages/alpha-1", 200, "POST", alice.cookie, { body: "A valid local message" }));
  it("malformed-json-returns-400 [app-policy]", () => status("/desk/api/draft", 400, "PUT", alice.cookie, '{"bad":'));
  it("oversized-request-body-returns-413 [framework-body-limit]", () =>
    status("/desk/api/draft", 413, "PUT", alice.cookie, { version: 0, title: "Huge", body: "x".repeat(1100000) }));
  it("unsupported-http-method-returns-405 [framework-router]", () => status("/desk/api/tickets/alpha-1", 405, "DELETE", alice.cookie, {}));
  it("logout-cannot-be-triggered-by-GET [framework-router]", () => status("/auth/logout", 405, "GET", alice.cookie));
  it("external-return-path-blocked [app-policy+framework-action]", async () => {
    const r = await fetch(base + "/sign-in?/login", {
      method: "POST",
      redirect: "manual",
      headers: { origin: base, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "alice@alpha.test", password: "demo-pass-2026", next: "//attacker.invalid/stolen" }),
    });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get("location"), "/desk");
    return { location: "/desk" };
  });
  for (const next of ["/\t/attacker.invalid", "/\n/attacker.invalid", "/\\attacker.invalid", "https://attacker.invalid"]) {
    it("unsafe-return-path-normalized:" + JSON.stringify(next) + " [app-policy+framework-safeRedirect]", async () => {
      const r = await fetch(base + "/sign-in?/login", {
        method: "POST",
        redirect: "manual",
        headers: { origin: base, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: "alice@alpha.test", password: "demo-pass-2026", next }),
      });
      assert.equal(r.status, 303);
      assert.equal(r.headers.get("location"), "/desk");
      return { location: "/desk" };
    });
  }
  it("server-password-hash-not-in-browser-assets [framework-server-split]", async () => {
    const files = await readdir(join(fixture.root, "dist/client/assets"));
    const javascript = files.filter((file) => file.endsWith(".js"));
    assert.ok(javascript.length > 0, "Production build must have browser JavaScript to inspect");
    for (const file of javascript) {
      const text = await readFile(join(fixture.root, "dist/client/assets", file), "utf8");
      assert.ok(!text.includes("rivet-local-synthetic-fixture"), file);
      assert.ok(!text.includes("node:sqlite"), file);
    }
    return { javascriptFiles: files.filter((x) => x.endsWith(".js")).length };
  });
  let uploaded: { id: string; name: string };
  it("safe-text-attachment-upload [app-policy]", async () => {
    const form = new FormData();
    form.set("ticket", "alpha-1");
    form.set("file", new Blob(["private attachment"], { type: "text/plain" }), "notes.txt");
    const r = await fetch(base + "/desk/api/files", { method: "POST", headers: { origin: base, cookie: alice.cookie }, body: form });
    assert.equal(r.status, 200);
    uploaded = await r.json();
    assert.ok(uploaded.id);
    assert.equal(uploaded.name, "notes.txt");
    return { name: uploaded.name };
  });
  it("cross-tenant-attachment-IDOR [app-policy]", () => status("/desk/api/files/" + uploaded.id, 404, "GET", bob.cookie));
  it("attachment-download-is-not-inline-html [app-policy+framework-header]", async () => {
    const r = await send("/desk/api/files/" + uploaded.id, "GET", alice.cookie);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-disposition") ?? "", /^attachment;/);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(await r.text(), "private attachment");
    return { attachment: true, nosniff: true };
  });
  for (const [name, type] of [
    ["payload.html", "text/html"],
    ["payload.svg", "image/svg+xml"],
    ["bad\r\nX-Evil.txt", "text/plain"],
  ])
    it(`active-or-header-injection-upload-denied:${type}` + " [app-policy]", async () => {
      const f = new FormData();
      f.set("ticket", "alpha-1");
      f.set("file", new Blob(["<script>1</script>"], { type }), name);
      const r = await fetch(base + "/desk/api/files", { method: "POST", headers: { origin: base, cookie: alice.cookie }, body: f });
      assert.equal(r.status, 400);
      return { status: 400 };
    });
  it("application-upload-size-limit [app-policy]", async () => {
    const f = new FormData();
    f.set("ticket", "alpha-1");
    f.set("file", new Blob(["x".repeat(66000)], { type: "text/plain" }), "large.txt");
    const r = await fetch(base + "/desk/api/files", { method: "POST", headers: { origin: base, cookie: alice.cookie }, body: f });
    assert.equal(r.status, 400);
    return { status: 400 };
  });
  async function cart(cookie: string): Promise<Cart> {
    const response = await send("/store/api/cart", "GET", cookie);
    assert.equal(response.status, 200);
    return response.json();
  }
  it("client-price-and-total-tampering-rejected [app-policy]", async () => {
    const c = await cart(alice.cookie);
    return status("/store/api/cart", 400, "PUT", alice.cookie, { version: c.version, sku: "sku-1", quantity: 1, price: 1, total: 1 });
  });
  it("cross-user-cart-isolation [app-policy]", async () => {
    const c = await cart(alice.cookie);
    await status("/store/api/cart", 200, "PUT", alice.cookie, { version: c.version, sku: "sku-2", quantity: 1 });
    assert.equal((await cart(bob.cookie)).items.length, 0);
    return { isolated: true };
  });
  it("parallel-idempotent-checkout-creates-one-order [app-policy]", async () => {
    const c = await cart(alice.cookie),
      body = { version: c.version, key: "security-repeat-1" };
    const responses = await Promise.all([send("/store/api/checkout", "POST", alice.cookie, body), send("/store/api/checkout", "POST", alice.cookie, body)]);
    assert.deepEqual(
      responses.map((r) => r.status),
      [200, 200],
    );
    const [a, b] = await Promise.all(responses.map((r) => r.json() as Promise<Order>));
    assert.ok(a.id);
    assert.equal(a.id, b.id);
    await status("/store/api/orders/" + a.id, 200, "GET", alice.cookie);
    await status("/store/api/orders/" + a.id, 404, "GET", bob.cookie);
    return { sameOrder: true, foreignOrder: 404 };
  });
  it("parallel-last-stock-checkout-cannot-oversell [app-policy]", async () => {
    const sessions = [alice, bob];
    const revisions: number[] = [];
    for (const session of sessions) {
      const c = await cart(session.cookie);
      const r = await send("/store/api/cart", "PUT", session.cookie, { version: c.version, sku: "sku-24", quantity: 1 });
      assert.equal(r.status, 200);
      revisions.push((await r.json()).version);
    }
    const r = await Promise.all(sessions.map((s, i) => send("/store/api/checkout", "POST", s.cookie, { version: revisions[i], key: "last-stock-" + i })));
    assert.deepEqual(r.map((x) => x.status).sort(), [200, 409]);
    return { statuses: r.map((x) => x.status) };
  });
  it("SSE-tenant-isolation-with-live-foreign-marker [app-policy+framework-stream]", async () => {
    const controller = new AbortController();
    const response = await fetch(base + "/desk/api/events", { headers: { cookie: alice.cookie }, signal: controller.signal });
    assert.equal(response.status, 200);
    assert.ok(response.body);
    const reader = response.body.getReader();
    await withTimeout(reader.read(), "SSE did not become ready");
    const own = "alpha-sse-" + Date.now(),
      foreign = "beta-sse-" + Date.now();
    await status("/desk/api/messages/beta-1", 200, "POST", bob.cookie, { body: foreign });
    await status("/desk/api/messages/alpha-1", 200, "POST", alice.cookie, { body: own });
    let observed = "";
    try {
      await withTimeout(
        (async () => {
          for (let i = 0; i < 30; i++) {
            const next = await reader.read();
            if (next.done) throw Error("Stream closed before marker");
            observed += new TextDecoder().decode(next.value);
            if (observed.includes(own)) return;
          }
          throw Error("Marker not delivered");
        })(),
        "SSE marker timeout",
      );
      assert.ok(observed.includes(own));
      assert.ok(!observed.includes(foreign));
      return { ownDelivered: true, foreignDelivered: false };
    } finally {
      controller.abort();
    }
  });
  it("SSE-logout-revocation [app-policy+framework-stream]", async () => {
    const account = await login();
    const controller = new AbortController();
    try {
      const r = await fetch(base + "/desk/api/events", { headers: { cookie: account.cookie }, signal: controller.signal });
      assert.equal(r.status, 200);
      assert.ok(r.body);
      const reader = r.body.getReader();
      await withTimeout(reader.read(), "SSE did not become ready");
      await status("/auth/session", 200, "DELETE", account.cookie, {});
      const closed = await withTimeout(
        (async () => {
          for (let i = 0; i < 10; i++) if ((await reader.read()).done) return true;
          return false;
        })(),
        "SSE remained open after logout",
      );
      assert.equal(closed, true);
    } finally {
      controller.abort();
    }
  });
  it("logout-revokes-captured-session-token [app-policy+framework-cookie]", async () => {
    const account = await login("editor@alpha.test");
    const r = await send("/auth/session", "DELETE", account.cookie, {});
    assert.equal(r.status, 200);
    await status("/desk", 401, "GET", account.cookie);
    return { oldTokenRejected: true };
  });

  async function upgradeStatus(cookie: string, origin: string | null): Promise<number> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(base.replace("http:", "ws:") + "/case-socket", {
        headers: { ...(cookie ? { cookie } : {}), ...(origin === null ? {} : { origin }) },
      });
      const timer = setTimeout(() => {
        ws.terminate();
        reject(Error("WebSocket handshake timeout"));
      }, 1500);
      let handshakeRejected = false;
      ws.on("error", (error) => {
        clearTimeout(timer);
        if (!handshakeRejected) reject(error);
      });
      ws.on("open", () => {
        clearTimeout(timer);
        ws.close();
        resolve(101);
      });
      ws.on("unexpected-response", (_req, r) => {
        clearTimeout(timer);
        handshakeRejected = true;
        r.resume();
        ws.terminate();
        if (r.statusCode === undefined) reject(new Error("WebSocket rejection has no HTTP status"));
        else resolve(r.statusCode);
      });
    });
  }
  interface SocketEvent {
    type: string;
    body?: string;
    tenant?: string;
  }
  interface PrivateSocket {
    ws: WebSocket;
    seen: SocketEvent[];
    ready: SocketEvent;
  }
  async function openPrivate(cookie: string): Promise<PrivateSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(base.replace("http:", "ws:") + "/case-socket", { headers: { cookie, origin: base } }),
        seen: SocketEvent[] = [];
      const timer = setTimeout(() => {
        ws.terminate();
        reject(Error("WebSocket ready timeout"));
      }, 1500);
      ws.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      ws.on("message", (data) => {
        try {
          const event = JSON.parse(String(data)) as SocketEvent;
          seen.push(event);
          if (event.type === "ready") {
            clearTimeout(timer);
            resolve({ ws, seen, ready: event });
          }
        } catch (error: unknown) {
          clearTimeout(timer);
          ws.terminate();
          reject(error);
        }
      });
    });
  }
  it("websocket-anonymous-handshake-denied [app-upgrade-policy]", async () => {
    assert.equal(await upgradeStatus("", base), 401);
    return { status: 401 };
  });
  it("websocket-forged-cookie-denied [app-upgrade-policy]", async () => {
    assert.equal(await upgradeStatus("case-session=" + "f".repeat(64), base), 401);
    return { status: 401 };
  });
  it("websocket-cross-site-hijack-denied [app-upgrade-policy]", async () => {
    assert.equal(await upgradeStatus(alice.cookie, "https://attacker.invalid"), 403);
    return { status: 403 };
  });
  it("websocket-missing-origin-denied [app-upgrade-policy]", async () => {
    assert.equal(await upgradeStatus(alice.cookie, null), 403);
    return { status: 403 };
  });
  it("websocket-events-remain-within-tenant [app-upgrade-policy]", async () => {
    const socket = await openPrivate(alice.cookie);
    try {
      const secret = "beta-ws-" + Date.now(),
        own = "alpha-ws-" + Date.now();
      await status("/desk/api/messages/beta-1", 200, "POST", bob.cookie, { body: secret });
      await status("/desk/api/messages/alpha-1", 200, "POST", alice.cookie, { body: own });
      for (let i = 0; i < 30 && !socket.seen.some((e) => e.body?.includes(own)); i++) await new Promise((r) => setTimeout(r, 20));
      assert.ok(socket.seen.some((e) => e.body?.includes(own)));
      assert.ok(!socket.seen.some((e) => e.body?.includes(secret)));
      assert.ok(socket.seen.filter((e) => e.type === "message").every((e) => e.tenant === "alpha"));
      return { tenant: "alpha", foreignMessages: 0 };
    } finally {
      socket.ws.close();
    }
  });
  it("websocket-closed-after-session-revoked [app-upgrade-policy]", async () => {
    const account = await login("editor@alpha.test"),
      socket = await openPrivate(account.cookie);
    const closed = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.ws.terminate();
        reject(Error("Revoked socket remained open"));
      }, 1500);
      socket.ws.on("close", (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });
    await status("/auth/session", 200, "DELETE", account.cookie, {});
    assert.equal(await closed, 4001);
    return { closeCode: 4001 };
  });
});
