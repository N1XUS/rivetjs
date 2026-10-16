// Route cache hash CSP in real engines (`server/route-cache.ts`, spec docs/design/specs/2026-10-12-route-cache.md D5),
// Chromium + Firefox: a stored page's policy (hashes of the nonce'd inline scripts + 'self') lets the resume loader's
// `import()` chain run with a clean console, keeps injected inline scripts blocked, and lets a parser-inserted
// same-origin `<script src>` run ('self': the documented delta vs the nonce policy). Why not `hashes +
// 'strict-dynamic'`: Chromium and Firefox do not pass a hash's trust on to `import()` (only to
// `createElement("script")`; WebKit does both), pinned here so a browser change shows up.
// Run: `npx vitest run --project router libs/router/tests/route-cache-csp.test.ts` (playwright chromium; firefox when
// installed — CI installs chromium only, so the firefox case skips there).
import { test } from "vitest";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chromium, firefox, type BrowserType } from "playwright";
import { withRouteRules, type CachePolicy } from "../server/route-cache.ts";
import type { AppHandler } from "../server/handler.ts";
import { serve } from "../adapters/node.ts";

const LOADER = `import("/a.js").then((m) => m.go()).then((v) => (document.title = v), (e) => (document.title = "ERR " + e))`;
const CREATE = `const s = document.createElement("script"); s.type = "module"; s.src = "/m.js"; document.head.append(s)`;
const MODULES: Record<string, string> = {
  "/a.js": `export async function go() { const b = await import("/b.js"); return "OK " + b.v; }`,
  "/b.js": `export const v = 42;`,
  "/m.js": `import("/a.js").then((m) => m.go()).then((v) => (document.title = v), (e) => (document.title = "ERR " + e))`,
  "/src.js": `window.parserSrc = 1;`,
};
// Markup the app did not nonce (as injected HTML would be): never hashed.
const INJECTED = `<script>window.injected = 1</script><script src="/src.js"></script>`;
const policy: CachePolicy = { policy: (nonce) => `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`, hash: {} };
const sha = (code: string) => `'sha256-${createHash("sha256").update(code).digest("base64")}'`;
const app: AppHandler = async (request, context) => {
  const path = new URL(request.url).pathname;
  if (MODULES[path]) return new Response(MODULES[path], { headers: { "content-type": "text/javascript" } });
  // The policy a hash + 'strict-dynamic' store would send, for the browser-behaviour pins below.
  const pinned = path === "/plain" ? LOADER : path === "/plain-create" ? CREATE : null;
  if (pinned !== null)
    return new Response(`<html><head><script>${pinned}</script></head><body></body></html>`, {
      headers: { "content-type": "text/html", "content-security-policy": `script-src ${sha(pinned)} 'strict-dynamic'; object-src 'none'` },
    });
  const extra = path === "/injected" ? INJECTED : "";
  return new Response(`<html><head><script nonce="${context!.nonce}">${LOADER}</script></head><body>${extra}</body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "content-security-policy": policy.policy(context!.nonce!) as string },
  });
};

for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
] as [string, BrowserType][]) {
  test.skipIf(!existsSync(engine.executablePath()))(
    `${name}: stored page hash policy runs the import() chain, blocks injected inline scripts; hashes + 'strict-dynamic' would block import()`,
    async () => {
      const serving = await serve({ handler: withRouteRules(app, { "/page": { swr: 60 }, "/injected": { swr: 60 } }, policy), port: 0 });
      const browser = await engine.launch({ headless: true, ...(name === "chromium" ? { args: ["--use-mock-keychain", "--password-store=basic"] } : {}) });
      try {
        const visit = async (path: string) => {
          const page = await browser.newPage();
          const errors: string[] = [];
          page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
          const response = await page.goto(serving.url + path);
          await page.waitForFunction(() => document.title !== "");
          const flags = await page.evaluate(() => [(window as { injected?: number }).injected ?? 0, (window as { parserSrc?: number }).parserSrc ?? 0]);
          const result = {
            state: response!.headers()["x-rivet-cache"],
            csp: response!.headers()["content-security-policy"],
            title: await page.title(),
            errors,
            flags,
          };
          await page.close();
          return result;
        };
        // No fixed origin: stored on the second miss.
        assert.equal((await visit("/page")).state, undefined);
        const miss = await visit("/page");
        assert.equal(miss.state, "MISS");
        const hit = await visit("/page");
        assert.equal(hit.state, "HIT");
        assert.match(hit.csp!, /^script-src 'sha256-[^']+' 'self'; /);
        for (const result of [miss, hit]) assert.equal(result.title, "OK 42");
        assert.deepEqual(hit.errors, []);
        // Injected markup: the inline script stays blocked on MISS (nonce) and HIT (hashes); a parser-inserted
        // same-origin script file runs on the HIT only ('self' — the delta the guide documents).
        await visit("/injected");
        const injectedMiss = await visit("/injected");
        const injectedHit = await visit("/injected");
        assert.deepEqual([injectedMiss.state, injectedHit.state], ["MISS", "HIT"]);
        assert.deepEqual(injectedMiss.flags, [0, 0]);
        assert.deepEqual(injectedHit.flags, [0, 1]);
        assert.equal(injectedHit.title, "OK 42");
        // Engine behaviour the policy works around: a hash's trust reaches createElement("script"), not import().
        assert.match((await visit("/plain")).title, /^ERR /);
        assert.equal((await visit("/plain-create")).title, "OK 42");
      } finally {
        await browser.close();
        await serving.close();
      }
    },
  );
}
