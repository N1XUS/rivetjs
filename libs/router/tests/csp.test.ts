import { test } from "vitest";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { hashCSP } from "../adapters/static.ts";
import { strictCSP } from "../server/strict-csp.ts";
import { cspPolicy } from "../shared/csp.ts";

const sha = (code: string) => `'sha256-${createHash("sha256").update(code).digest("base64")}'`;
const policyOf = (html: string) => /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)?.[1];

test("strictCSP: directives merge (script-src additive, object-src replaced, new ones appended), default unchanged", () => {
  assert.equal(strictCSP("n"), "script-src 'nonce-n' 'strict-dynamic'; object-src 'none'; base-uri 'none'");
  assert.equal(strictCSP("n", { directives: {} }), strictCSP("n"));
  assert.equal(
    strictCSP("n", {
      trustedTypes: true,
      directives: {
        "script-src": "'wasm-unsafe-eval' 'strict-dynamic'",
        "worker-src": ["'self'", "blob:"],
        "img-src": "'self' data: https://cdn.test",
        "upgrade-insecure-requests": true,
      },
    }),
    "script-src 'nonce-n' 'strict-dynamic' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; worker-src 'self' blob:; img-src 'self' data: https://cdn.test; upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types rivet",
  );
  // Header policies may carry frame-ancestors / reporting.
  assert.match(strictCSP("n", { directives: { "Frame-Ancestors": "'none'" } }), /; frame-ancestors 'none'$/);
});

test("cspPolicy: validation (unknown names, Trusted Types via the option, injection, meta-only limits)", () => {
  const base = [["script-src", ["'self'"]]] as const;
  assert.throws(() => cspPolicy(base, { directives: { "scrpt-src": "x" } }), /Unknown CSP directive "scrpt-src"/);
  assert.throws(() => cspPolicy(base, { directives: { "trusted-types": "a" } }), /use the trustedTypes option/);
  assert.throws(() => cspPolicy(base, { directives: { "img-src": "x; script-src *" } }), /Invalid CSP source "x;"/);
  assert.throws(() => cspPolicy(base, { directives: { "img-src": ['a"b'] } }), /Invalid CSP source/);
  assert.throws(() => cspPolicy(base, { directives: { "img-src": ["'self"] } }), /Invalid CSP source/);
  assert.throws(() => cspPolicy(base, { directives: { "frame-ancestors": "'none'" } }, true), /ignored in a <meta> policy/);
  // `'unsafe-inline'` is never added implicitly, only when asked for.
  assert.doesNotMatch(cspPolicy(base, { directives: { "style-src": "'self'" } }), /unsafe-inline/);
  assert.equal(cspPolicy(base, { directives: { "style-src-attr": "'unsafe-inline'" } }), "script-src 'self'; style-src-attr 'unsafe-inline'");
  // script-src-elem starts from the generated script-src so the page's own scripts keep running.
  assert.equal(cspPolicy(base, { directives: { "script-src-elem": "https://cdn.test" } }), "script-src 'self'; script-src-elem 'self' https://cdn.test");
});

test("hashCSP: extra directives join the hash policy; a script-less page gets a policy only when directives are given", () => {
  const html = `<!doctype html><html><head></head><body><script>run()</script></body></html>`;
  assert.equal(
    policyOf(
      hashCSP(html, { directives: { "script-src": "'wasm-unsafe-eval'", "worker-src": "'self' blob:", "connect-src": "'self' https://formcarry.test" } }),
    ),
    `script-src ${sha("run()")} 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; worker-src 'self' blob:; connect-src 'self' https://formcarry.test`,
  );
  assert.equal(hashCSP("<head></head><p>x</p>"), "<head></head><p>x</p>");
  assert.equal(
    policyOf(hashCSP("<head></head><p>x</p>", { directives: { "img-src": "'self'" } })),
    "script-src 'self'; object-src 'none'; base-uri 'none'; img-src 'self'",
  );
  assert.throws(() => hashCSP(html, { directives: { "report-uri": "/csp" } }), /ignored in a <meta> policy/);
});

test("hashCSP: the policy <meta> follows a leading charset and viewport <meta> (charset first), else opens the head", () => {
  const body = "<body><script>1</script></body>";
  assert.match(
    hashCSP(`<head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width"><title>t</title></head>${body}`),
    /^<head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="[^"]*"><title>/,
  );
  assert.match(hashCSP(`<head><meta charset=utf-8><title>t</title></head>${body}`), /^<head><meta charset=utf-8><meta http-equiv="Content-Security-Policy"/);
  assert.match(hashCSP(`<head><title>t</title><meta charset="utf-8"></head>${body}`), /^<head><meta http-equiv="Content-Security-Policy"[^>]*><title>/);
});

test("hashCSP in Chromium: 'wasm-unsafe-eval' and worker-src blob: let WebAssembly and blob workers run", async () => {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  // Smallest valid wasm module (magic + version).
  const script = `
    document.addEventListener("securitypolicyviolation", (e) => (window.violations ||= []).push(e.violatedDirective));
    window.result = Promise.allSettled([
      WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])).then(() => "wasm"),
      new Promise((ok, fail) => {
        try {
          const worker = new Worker(URL.createObjectURL(new Blob(["postMessage(1)"], { type: "text/javascript" })));
          worker.onmessage = () => ok("worker");
          worker.onerror = () => fail(new Error("worker"));
        } catch (error) { fail(error); }
      }),
    ]).then((all) => all.map((r) => r.status));`;
  const page = (options?: Parameters<typeof hashCSP>[1]) =>
    hashCSP(`<!doctype html><html><head></head><body><script>${script}</script></body></html>`, options);
  try {
    const run = async (body: string) => {
      const tab = await browser.newPage();
      await tab.route("http://site.test/**", (route) => route.fulfill({ contentType: "text/html", body }));
      await tab.goto("http://site.test/");
      const statuses = await tab.evaluate(() => (window as unknown as { result: Promise<string[]> }).result);
      const violations = await tab.evaluate(() => (window as unknown as { violations?: string[] }).violations ?? []);
      await tab.close();
      return { statuses, violations };
    };
    const blocked = await run(page());
    assert.deepEqual(blocked.statuses, ["rejected", "rejected"]);
    assert.ok(blocked.violations.includes("script-src"), blocked.violations.join());
    const allowed = await run(page({ directives: { "script-src": "'wasm-unsafe-eval'", "worker-src": "'self' blob:" } }));
    assert.deepEqual(allowed, { statuses: ["fulfilled", "fulfilled"], violations: [] });
  } finally {
    await browser.close();
  }
});

test("createApp csp directives: merge module loads at startup (pay-per-use), first requests wait for it", async () => {
  const { createApp } = await import("../server/app.ts");
  const entry = {
    routes: [{ id: "p", pattern: "/p", page: true, layouts: [] }],
    universal: {},
    page: () => () => "page",
    document: () => ({ start: "<body>", end: "</body>" }),
  };
  const get = () => new Request("http://x/p");
  const nonce = "bm9uY2U=";
  const policy = async (handler: ReturnType<typeof createApp>) => (await handler(get(), { nonce })).headers.get("content-security-policy");
  assert.equal(await policy(createApp({ entry })), `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`);
  assert.match((await policy(createApp({ entry, csp: { trustedTypes: true } })))!, /; trusted-types rivet$/);
  const csp = { directives: { "script-src": "'wasm-unsafe-eval'", "worker-src": "'self' blob:" } };
  // Request before the module settled, then after: same merged policy.
  const handler = createApp({ entry, csp });
  const first = policy(handler);
  assert.equal(await first, strictCSP(nonce, csp));
  assert.equal(
    await policy(handler),
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; worker-src 'self' blob:`,
  );
});
