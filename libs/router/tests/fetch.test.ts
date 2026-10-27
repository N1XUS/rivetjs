// Fetch/edge adapter: `rivetRouter({ adapter: "fetch" })` makes `vite build --ssr` also emit
// `dist/server/fetch.js` (`export default { fetch }`, manifests inlined, no fs). The bundle must be
// edge-safe (only `node:async_hooks`) and answer like the node adapter for the same build.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { start } from "../adapters/node.ts";
import { createFetch, type FetchModule } from "../adapters/fetch.ts";
import { loadBuild } from "../adapters/build.ts";
import { createDecoder } from "@rivetjs/runtime/resume-format";

const root = new URL("./fixture-fetch/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";
const dist = root + "dist/";

const files = async (dir: string): Promise<string[]> =>
  (await readdir(dir, { recursive: true, withFileTypes: true })).filter((e) => e.isFile() && e.name.endsWith(".js")).map((e) => join(e.parentPath, e.name));
const unnonce = (html: string) => html.replace(/nonce(=")?[-A-Za-z0-9+/=_]{16,}/g, "nonce$1N");

test(
  "fetch adapter: edge-safe bundle with inlined manifests, same pages as the node adapter",
  steps(async (t) => {
    await rm(dist, { recursive: true, force: true });
    await build({ root, configFile, logLevel: "silent" });
    await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
    const bundle = dist + "server/fetch.js";
    const node = await start({ dist, port: 0, onError: () => {} });
    const worker = ((await import(pathToFileURL(bundle).href)) as { default: FetchModule }).default;
    try {
      await t.test("bundle imports only node:async_hooks and never reads files", async () => {
        const builtins = new Set<string>();
        for (const file of await files(dist + "server")) {
          const source = await readFile(file, "utf8");
          for (const [, spec] of source.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)) {
            if (spec!.startsWith("node:") || !spec!.startsWith(".")) builtins.add(spec!);
          }
          assert.doesNotMatch(source, /\breadFile|\bpathToFileURL|\bcreateRequire|\bprocess\.cwd|\.vite\/manifest\.json|rivet-resume\.json/, file);
        }
        assert.deepEqual([...builtins], ["node:async_hooks"]);
        const source = await readFile(bundle, "utf8");
        assert.match(source, /export\s*\{[^}]*\bas default\b|export default/);
      });

      await t.test("GET / renders the same HTML as the node adapter (modulo nonce), with CSP and resume state", async () => {
        const [a, b] = await Promise.all([fetch(node.url + "/"), worker.fetch(new Request(node.url + "/"))]);
        assert.equal(b.status, 200);
        assert.equal(b.headers.get("content-type"), a.headers.get("content-type"));
        const csp = b.headers.get("content-security-policy")!;
        const nonce = /'nonce-([^']+)'/.exec(csp)![1]!;
        assert.equal(csp, `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`);
        assert.equal(atob(nonce).length, 16);
        assert.equal(unnonce(a.headers.get("content-security-policy")!), unnonce(csp));
        assert.equal(b.headers.get("x-content-type-options"), "nosniff");
        assert.equal(b.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
        const [htmlA, htmlB] = [await a.text(), await b.text()];
        assert.equal(unnonce(htmlB), unnonce(htmlA));
        assert.match(htmlB, /<h1>Hello edge<\/h1>/);
        assert.match(htmlB, /<script type="rivet\/boundaries"/);
        assert.match(htmlB, /<link rel="stylesheet" href="\/assets\/styles-[^"]+\.css">/);
        for (const tag of htmlB.match(/<script\b[^>]*>/g)!) assert.ok(tag.includes(`nonce="${nonce}"`) || /type="rivet\/boundaries"/.test(tag), tag);
        // Fresh nonce per request.
        const again = await worker.fetch(new Request(node.url + "/"));
        assert.notEqual(again.headers.get("content-security-policy"), csp);
      });

      await t.test("csp option: start(), loadBuild() and create() pass it to createApp", async () => {
        const { create } = (await import(pathToFileURL(bundle).href)) as { create(options?: object): FetchModule };
        const header = async (module: FetchModule) => (await module.fetch(new Request(node.url + "/"))).headers.get("content-security-policy");
        assert.match(
          (await header(create({ csp: { trustedTypes: true } })))!,
          /'strict-dynamic'; object-src 'none'; base-uri 'none'; require-trusted-types-for 'script'; trusted-types rivet rivet-script$/,
        );
        assert.match(
          (await header(create({ csp: (n: string) => `default-src 'self'; script-src 'nonce-${n}'` })))!,
          /^default-src 'self'; script-src 'nonce-[^']+'$/,
        );
        assert.equal(await header(create({ csp: false })), null);
        const off = await start({ dist, port: 0, csp: false, onError: () => {} });
        const typed = await start({ dist, port: 0, csp: { trustedTypes: ["mine"] }, onError: () => {} });
        try {
          assert.equal((await fetch(off.url + "/")).headers.get("content-security-policy"), null);
          assert.match((await fetch(typed.url + "/")).headers.get("content-security-policy")!, /trusted-types rivet rivet-script mine$/);
        } finally {
          await off.close();
          await typed.close();
        }
        const loaded = await loadBuild(dist, { csp: (n) => `script-src 'nonce-${n}'` });
        const response = await loaded.handler(new Request("http://x.example/"), { nonce: "abc" });
        assert.equal(response.headers.get("content-security-policy"), "script-src 'nonce-abc'");
      });

      await t.test("env/ctx reach loaders as event.platform", async () => {
        const html = await (await worker.fetch(new Request("http://edge.example/"), { KV: {} }, { waitUntil() {} })).text();
        assert.match(html, /<p id="platform">env<\/p>/);
      });

      await t.test("data endpoint and unknown routes match the node adapter", async () => {
        for (const path of ["/counter?_rivet=data", "/missing", "/assets/nope.js"]) {
          const [a, b] = await Promise.all([fetch(node.url + path), worker.fetch(new Request(node.url + path))]);
          // The node adapter serves files from dist/client first; the fetch adapter leaves assets to the platform.
          assert.equal(b.status, a.status, path);
          assert.equal(unnonce(await b.text()), unnonce(await a.text()), path);
        }
      });

      await t.test("action POST: same-origin works, cross-origin is 403", async () => {
        const post = (origin: string) =>
          worker.fetch(
            new Request("http://edge.example/counter?/inc", {
              method: "POST",
              headers: { origin, accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
              body: "",
            }),
          );
        const ok = await post("http://edge.example");
        assert.equal(ok.status, 200);
        const { t, r } = JSON.parse(await ok.text()) as { t: unknown[]; r: number };
        assert.deepEqual(createDecoder(t).get(r), { action: { name: "inc", result: { count: 1 } } });
        assert.equal((await post("https://evil.example")).status, 403);
      });

      await t.test("HEAD has no body", async () => {
        const head = await worker.fetch(new Request(node.url + "/", { method: "HEAD" }));
        assert.equal(head.status, 200);
        assert.equal(head.body, null);
      });

      await t.test("bundle runs under Bun when installed", { skip: !hasBun() && "bun not installed" }, async () => {
        const script = dist + "bun-check.mjs";
        await writeFile(
          script,
          `import worker from "./server/fetch.js";\nconst r = await worker.fetch(new Request("http://edge.example/"));\nconsole.log([r.status, (await r.text()).includes("<h1>Hello edge</h1>"), r.headers.get("content-security-policy")?.startsWith("script-src 'nonce-")].join(" "));\n`,
        );
        assert.equal(execFileSync("bun", [script], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" } }).trim(), "200 true true");
      });
    } finally {
      await node.close();
    }
  }),
);

test("createFetch: fixed origin, serveAssets hook, errors, base headers", async () => {
  const seen: string[] = [];
  const entry = {
    routes: [],
    universal: {},
    page: () => () => "",
    document: () => ({ start: "", end: "" }),
    createApp: () => async (request: Request, context?: { nonce?: string; platform?: Record<string, unknown> }) => {
      seen.push(request.url + " " + (context?.nonce ? "nonce" : "-") + " " + Object.keys(context?.platform ?? {}).join(","));
      if (request.url.endsWith("/boom")) throw new Error("boom");
      return new Response("page " + (await request.text()), { headers: { "x-content-type-options": "custom" } });
    },
  };
  const errors: unknown[] = [];
  const worker = createFetch(
    entry as never,
    { clients: [{ base: "/", manifest: { runtime: "/r.js", symbols: {} }, vite: {} }] },
    {
      origin: "https://shop.example",
      headers: { "x-extra": "1" },
      onError: (error) => errors.push(error),
      serveAssets: (request) => (new URL(request.url).pathname === "/robots.txt" ? new Response("robots") : undefined),
    },
  );
  assert.equal(await (await worker.fetch(new Request("http://internal:8080/robots.txt"))).text(), "robots");
  const page = await worker.fetch(new Request("http://internal:8080/a?b=1", { method: "POST", body: "hi" }), { A: 1 }, { waitUntil() {} });
  assert.equal(await page.text(), "page hi");
  assert.equal(page.headers.get("x-content-type-options"), "custom");
  assert.equal(page.headers.get("x-extra"), "1");
  assert.deepEqual(seen, ["https://shop.example/a?b=1 nonce env,ctx"]);
  const failed = await worker.fetch(new Request("http://internal/boom"));
  assert.equal(failed.status, 500);
  assert.equal(await failed.text(), "Internal Server Error");
  assert.equal(errors.length, 1);
});

function hasBun(): boolean {
  try {
    execFileSync("bun", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
