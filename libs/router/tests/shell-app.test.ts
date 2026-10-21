// Shell cache end to end (route rule `shell`, `server/shell-cache.ts`; production build of fixture-shell): a signed-in
// miss stores the shell, later visitors (other sessions) get the stored prefix at once and their own holes; a hit's
// document is byte-identical to a fresh render modulo the nonce, muted (PPR-T3B) or replayed in full; shell loaders do
// not run on hits; guards do; fills that read request input outside the key are not stored (cookie, header, locals, unkeyed query parameter, the search params
// context in render, deferred data rendered in order); unkeyed query parameters bypass; `revalidate()` drops; a stale
// shell is re-filled by a detached anonymous request (R3); a replay that differs from the stored shell ends with the
// mismatch fallback and stops filling the route (R1); a deferred loader's redirect becomes a client redirect (R5). In
// Chromium: the first clicks on a hole and on the shell behave the same after a hit as after a miss, CSP
// `'strict-dynamic'` keeps working with the live nonce, a forced `h` mismatch reloads once and then works. Dev: the
// dev server names each forbidden read (`x-rivet-cache: SHELL-BYPASS …` + a warning) and throws DeferredDataError for
// deferred data rendered in the shell.
// Run: `npx vitest run --project router libs/router/tests/shell-app.test.ts`.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { build, createServer } from "vite";
import { chromium } from "playwright";
import { loadBuild } from "../adapters/build.ts";
import { start } from "../adapters/node.ts";
import { nodeEnv } from "./vite-env.ts";

const root = new URL("./fixture-shell/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";
const ORIGIN = "http://localhost";
const TEST = Symbol.for("rivet.shellTest");
const revalidate = (target: { path?: string; tag?: string }): number =>
  (globalThis as unknown as Record<symbol, (target: object) => number>)[Symbol.for("rivet.revalidate.local")]!(target);
/** The document with every CSP nonce attribute value blanked. */
const unnonced = (html: string) => html.replace(/ nonce="[^"]*"/g, ' nonce=""');
let counter = 0;
const nonce = () => "nonce" + (++counter).toString(36).padStart(4, "0");

test(
  "shell cache: stored shell + live holes, request-read tracking, fallbacks",
  steps(async (t) => {
    delete process.env.GATE_AUTO;
    await rm(root + "dist", { recursive: true, force: true });
    await build({ root, configFile, logLevel: "silent" });
    await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
    const { handler } = await loadBuild(root + "dist", { onError: () => {}, routeCache: { origin: ORIGIN } });
    const get = (path: string, user?: string, headers: Record<string, string> = {}) =>
      handler(new Request(ORIGIN + path, { headers: { ...(user ? { cookie: "user=" + user } : {}), ...headers } }), { nonce: nonce() });
    const runs = async (): Promise<Record<string, number>> => (await handler(new Request(ORIGIN + "/gate"))).json();
    const opened = (name: string) => handler(new Request(ORIGIN + "/gate?open=" + name));
    /** Read a body while opening the user gate once the shell is out. */
    const read = async (response: Response): Promise<{ html: string; shell: string }> => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let html = "",
        shell = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return { html, shell };
        html += decoder.decode(value, { stream: true });
        // The first chunk: the shell (a hit's stored prefix; a miss's held shell); then the hole may settle.
        if (!shell) {
          shell = html;
          void opened("user");
        }
      }
    };

    let missHTML = "";
    await t.test("miss (signed in): streams as today, stores the shell; the hit sends it before any loader settles", async () => {
      const miss = await get("/article", "ann");
      assert.equal(miss.status, 200);
      assert.equal(miss.headers.get("x-rivet-cache"), "SHELL-MISS");
      assert.equal(miss.headers.get("cache-control"), "private, no-cache");
      const first = await read(miss);
      missHTML = first.html;
      assert.match(first.html, /Hello ann/);
      assert.doesNotMatch(first.shell, /Hello ann/, "the hole streams after the shell");
      const before = await runs();
      const hit = await get("/article", "bob");
      assert.equal(hit.headers.get("x-rivet-cache"), "SHELL-HIT");
      assert.equal(hit.headers.get("cache-control"), "private, no-cache");
      const second = await read(hit);
      assert.match(second.shell, /<h1 id="title">Shell article<\/h1>/);
      assert.doesNotMatch(second.shell, /Hello bob/);
      assert.match(second.html, /Hello bob/);
      assert.doesNotMatch(second.html, /Hello ann/, "no other visitor's hole");
      const after = await runs();
      assert.equal(after.article, before.article, "the shell loader did not run on the hit");
      assert.equal(after.user, (before.user ?? 0) + 1, "the deferred loader ran live");
    });

    await t.test("a signed-in hit's document is byte-identical to a fresh render, modulo the nonce", async () => {
      const hit = await get("/article", "ann");
      assert.equal(hit.headers.get("x-rivet-cache"), "SHELL-HIT");
      const { html } = await read(hit);
      assert.notEqual(html, missHTML, "own nonce");
      assert.equal(unnonced(html), unnonced(missHTML));
      const nonces = new Set([...html.matchAll(/ nonce="([^"]*)"/g)].map((match) => match[1]));
      assert.equal(nonces.size, 1, "one live nonce everywhere (stored slots re-filled)");
      assert.match(hit.headers.get("content-security-policy")!, new RegExp(`'nonce-${[...nonces][0]}' 'strict-dynamic'`));
    });

    await t.test("muted replay (no root state encode, shell bytes compared in place) = full replay, byte for byte", async () => {
      const muted = await get("/article", "ann");
      assert.equal(muted.headers.get("x-rivet-cache"), "SHELL-HIT");
      const mutedHTML = (await read(muted)).html;
      (globalThis as unknown as Record<symbol, unknown>)[TEST] = { full: true };
      try {
        const full = await get("/article", "ann");
        assert.equal(full.headers.get("x-rivet-cache"), "SHELL-HIT");
        assert.equal(unnonced((await read(full)).html), unnonced(mutedHTML));
      } finally {
        delete (globalThis as unknown as Record<symbol, unknown>)[TEST];
      }
      // Every 64th hit of an entry replays in full (`VERIFY`): a run of hits stays byte-identical across it.
      for (let i = 0; i < 70; i++) assert.equal(unnonced((await read(await get("/article", "ann"))).html), unnonced(mutedHTML), "hit " + i);
    });

    await t.test("guards run on hits (R4): an anonymous visitor is redirected before the stored shell goes out", async () => {
      await read(await get("/private", "ann"));
      const member = await get("/private", "bob");
      assert.equal(member.headers.get("x-rivet-cache"), "SHELL-HIT");
      await read(member);
      const anonymous = await get("/private");
      assert.equal(anonymous.status, 302);
      assert.equal(anonymous.headers.get("location"), "/other");
    });

    for (const [path, what] of [
      ["/cookie", "cookie"],
      ["/header", "request header"],
      ["/locals", "locals"],
      ["/search?page=2", "query parameter outside the key"],
      ["/context?page=2", "search params context in render"],
      ["/inorder", "deferred data rendered in order"],
    ] as const)
      await t.test(`a fill reading a ${what} is not stored (${path})`, async () => {
        for (const user of ["ann", "bob", "cy"]) {
          const response = await get(path, user, { "x-agent": "bot" });
          assert.equal(response.status, 200);
          assert.equal(response.headers.get("x-rivet-cache"), null, `${path} ${user}`);
          const { html } = await read(response);
          assert.doesNotMatch(html, /self\.\$rvh/);
        }
      });

    await t.test("unkeyed query parameters render without the shell; keyed queries are separate shells", async () => {
      const extra = await get("/search?page=2&sort=old", "ann");
      assert.equal(extra.headers.get("x-rivet-cache"), null);
      assert.match((await read(extra)).html, /<p id="page">2 old<\/p>/);
      // `query: true` (default): a query string is client-chosen input, stored on its second miss.
      assert.equal((await get("/article?v=1", "ann")).headers.get("x-rivet-cache"), null);
      const second = await get("/article?v=1", "ann");
      assert.equal(second.headers.get("x-rivet-cache"), "SHELL-MISS");
      await read(second);
      assert.equal((await get("/article?v=1", "bob")).headers.get("x-rivet-cache"), "SHELL-HIT");
    });

    await t.test("data requests keep the JSON path; revalidate() drops shells", async () => {
      setTimeout(() => void opened("user"), 10);
      const data = await get("/article?_rivet=data", "ann");
      assert.match(data.headers.get("content-type")!, /json/);
      assert.equal(data.headers.get("x-rivet-cache"), null);
      assert.match(await data.text(), /Shell article/);
      assert.ok(revalidate({ path: "/article" }) >= 1);
      const refill = await get("/article", "bob");
      assert.equal(refill.headers.get("x-rivet-cache"), "SHELL-MISS");
      await read(refill);
    });

    await t.test("a replay that differs from the stored shell: no holes, mismatch fallback, the route stops filling (R1)", async () => {
      const warn = console.warn;
      const warned: string[] = [];
      console.warn = (...args: unknown[]) => void warned.push(args.join(" "));
      try {
        await read(await get("/clock", "ann"));
        const hit = await get("/clock", "bob");
        assert.equal(hit.headers.get("x-rivet-cache"), "SHELL-HIT");
        const { html } = await read(hit);
        assert.match(html, /Shell mismatch/);
        assert.match(html, /location\.reload\(\)/);
        assert.doesNotMatch(html, /Hello bob/, "no holes against a mismatched shell");
        assert.ok(warned.some((line) => line.includes('route "clock" not stored: shell mismatch on a hit')));
        const after = await get("/clock", "cy");
        assert.equal(after.headers.get("x-rivet-cache"), null, "evicted, sticky off");
        assert.match((await read(after)).html, /Hello cy/);
      } finally {
        console.warn = warn;
      }
    });

    await t.test("a deferred loader's redirect becomes a client redirect (R5)", async () => {
      const response = await get("/moved");
      assert.equal(response.status, 200);
      const { html } = await read(response);
      assert.match(html, /<p id="moved-error">moved<\/p>/);
      assert.match(html, /<script nonce="[^"]+">location\.replace\("\/other"\)<\/script><\/div><\/body><\/html>$/);
      const stays = await get("/moved", "ann");
      assert.doesNotMatch((await read(stays)).html, /location\.replace/);
    });

    await t.test("swr: a stale shell is served and re-filled by a detached anonymous request (R3)", async () => {
      const { handler: swr } = await loadBuild(root + "dist", {
        onError: () => {},
        routeRules: { "/**": { shell: { maxAge: 0, swr: 60 } }, "/gate": { shell: false } },
        routeCache: { origin: ORIGIN },
      });
      const fetchSWR = (user: string) => swr(new Request(ORIGIN + "/article", { headers: { cookie: "user=" + user } }), { nonce: nonce() });
      process.env.GATE_AUTO = "1";
      try {
        const miss = await fetchSWR("ann");
        assert.equal(miss.headers.get("x-rivet-cache"), "SHELL-MISS");
        await miss.text();
        const guests = (await runs())["as:guest"] ?? 0;
        const stale = await fetchSWR("bob");
        assert.equal(stale.headers.get("x-rivet-cache"), "SHELL-STALE");
        assert.match(await stale.text(), /Hello bob/);
        await new Promise((done) => setTimeout(done, 80));
        assert.equal((await runs())["as:guest"], guests + 1, "the re-fill rendered without the visitor's cookie");
        const again = await fetchSWR("cy");
        assert.equal(again.headers.get("x-rivet-cache"), "SHELL-STALE");
        assert.match(await again.text(), /Hello cy/);
      } finally {
        delete process.env.GATE_AUTO;
      }
    });

    process.env.GATE_AUTO = "1";
    // No fixed origin here: the doorkeeper stores a key on its second miss.
    const app = await start({ dist: root + "dist", port: 0, onError: () => {}, routeRules: { "/**": { shell: { maxAge: 3600 } }, "/gate": { shell: false } } });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
      await t.test("Chromium: first clicks on a hole and on the shell behave the same after a hit as after a miss", async () => {
        await fetch(app.url + "/article", { headers: { cookie: "user=zed" } }).then((r) => r.text());
        for (const expected of ["SHELL-MISS", "SHELL-HIT"]) {
          const context = await browser.newContext();
          await context.addCookies([{ name: "user", value: expected === "SHELL-MISS" ? "ann" : "bob", url: app.url }]);
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
          const response = await page.goto(app.url + "/article");
          assert.equal(response!.headers()["x-rivet-cache"], expected);
          const csp = response!.headers()["content-security-policy"]!;
          assert.match(csp, /'strict-dynamic'/);
          const live = /'nonce-([^']+)'/.exec(csp)![1]!;
          const nonces = await page.evaluate(() => [...document.querySelectorAll("script[nonce]")].map((s) => (s as HTMLScriptElement).nonce));
          assert.ok(nonces.length > 3 && nonces.every((value) => value === live), "every script carries the live nonce");
          await page.waitForSelector("#user");
          await page.click("#menu");
          await page.waitForFunction(() => document.querySelector("#menu")?.textContent === "Close");
          await page.click("#visits");
          await page.waitForFunction(() => document.querySelector("#visits")?.textContent === "Visits 1");
          await page.click("#like");
          await page.waitForFunction(() => document.querySelector("#like")?.textContent === "Likes 1");
          assert.deepEqual(errors, [], expected);
          await context.close();
        }
      });

      await t.test("Chromium: holes rendered against another shell (`h` mismatch, forced) reload once, then work", async () => {
        const context = await browser.newContext();
        await context.addCookies([{ name: "user", value: "dee", url: app.url }]);
        const page = await context.newPage();
        const loads: string[] = [];
        page.on("response", (response) => response.url() === app.url + "/article" && loads.push(response.headers()["x-rivet-cache"] ?? ""));
        (globalThis as unknown as Record<symbol, { holes: number }>)[TEST] = { holes: 1 };
        try {
          await page.goto(app.url + "/article");
          await page.waitForFunction(() => document.querySelector("#user")?.textContent?.includes("Hello dee"));
          assert.deepEqual(loads, ["SHELL-HIT", "SHELL-HIT"], "one reload");
          assert.equal(await page.evaluate(() => sessionStorage.getItem("rivet:shell")), null, "flag cleared once the holes matched");
          await page.click("#menu");
          await page.waitForFunction(() => document.querySelector("#menu")?.textContent === "Close");
        } finally {
          delete (globalThis as unknown as Record<symbol, unknown>)[TEST];
          await context.close();
        }
      });
    } finally {
      await browser.close();
      await app.close();
      delete process.env.GATE_AUTO;
    }
  }),
);

test("dev: shell rules probe — each forbidden read named (header + warning), deferred data in the shell throws", async () => {
  process.env.GATE_AUTO = "1";
  const restoreEnv = nodeEnv("development");
  const warn = console.warn;
  const warned: string[] = [];
  console.warn = (...args: unknown[]) => void warned.push(args.join(" "));
  const server = await createServer({ root, configFile, logLevel: "silent", server: { port: 0 } });
  await server.listen();
  try {
    const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
    const get = (path: string) => fetch(origin + path, { headers: { cookie: "user=ann; theme=dark", "x-agent": "bot" } });
    for (const [path, reason] of [
      ["/cookie", 'SHELL-BYPASS page "cookie" loader reads cookies.theme'],
      ["/header", 'SHELL-BYPASS page "header" loader reads request.headers.x-agent'],
      ["/locals", 'SHELL-BYPASS page "locals" loader reads locals.user'],
      ["/search?page=2", 'SHELL-BYPASS page "search" loader reads url.searchParams.sort'],
      ["/context?page=2", "SHELL-BYPASS render reads url.searchParams.sort"],
    ] as const) {
      const response = await get(path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("x-rivet-cache"), reason, path);
      await response.text();
    }
    const clean = await get("/article");
    assert.equal(clean.headers.get("x-rivet-cache"), null);
    await clean.text();
    const inorder = await get("/inorder");
    const html = await inorder.text();
    // The in-order read failed the render (DeferredDataError, reported through onError; dev pages get the marker).
    assert.match(html, /rivet:resume-error/);
    assert.doesNotMatch(html, /<p id="stock">/);
    assert.ok(warned.some((line) => line.includes('route "cookie" not stored: page "cookie" loader reads cookies.theme')));
    assert.ok(warned.some((line) => line.includes('route "inorder" not stored: the shell waits for deferred loader data')));
  } finally {
    console.warn = warn;
    await server.close();
    restoreEnv();
    delete process.env.GATE_AUTO;
  }
});
