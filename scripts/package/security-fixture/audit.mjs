// Runs only inside the Linux consumer image: all @rivetjs imports resolve installed tarballs.
import assert from "node:assert/strict";
import { readFile, readdir, realpath, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { build } from "vite";
import { start } from "@rivetjs/router/node";
import { chromium } from "playwright";
import { staticCases } from "./audit-static.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const results = [];
const serverErrors = [];
const onError = (error, request, info) => serverErrors.push({ url: request.url, error: String(error.stack ?? error), info });
const fetch = (url, options = {}) => globalThis.fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
const output = process.env.AUDIT_RESULTS ?? "/results";
await mkdir(output, { recursive: true });
const env = { node: process.version, platform: process.platform, arch: process.arch, os: await readFile("/etc/os-release", "utf8"), packages: [], tools: {} };
const check = async (name, run) => {
  try {
    await run();
    results.push({ name, pass: true });
  } catch (error) {
    results.push({ name, pass: false, error: String(error.stack ?? error) });
  }
  console.log(`${results.at(-1).pass ? "PASS" : "FAIL"} ${name}`);
};
const forbidden = [
  "PRIVATE_MODULE_CANARY_7e6f0b31",
  "INLINE_GUARD_CANARY_82ab20d4",
  "INLINE_LOADER_CANARY_4e9b1e89",
  "SIBLING_LOADER_CANARY_47c93ea0",
  "ENDPOINT_HANDLER_CANARY_931fd008",
];
const errors = { "/error": "LOADER_ERROR_CANARY_04ab7c91", "/render-error": "RENDER_ERROR_CANARY_1a87bb19", "/late-error": "LATE_ERROR_CANARY_e20318bd" };
const hostile = '</script><img id="injected" src=x onerror="globalThis.__auditXss=1"><script>globalThis.__auditXss=2</script>"&\u2028\u2029';
let infrastructure;
try {
  const manifestBytes = await readFile("/audit-manifest.json");
  assert.equal(createHash("sha256").update(manifestBytes).digest("hex"), process.env.AUDIT_MANIFEST_SHA256, "stale image: rebuild without --no-image");
  const auditManifest = JSON.parse(manifestBytes);
  for (const item of auditManifest.fixture) {
    assert.equal(
      createHash("sha256")
        .update(await readFile(join(root, item.file)))
        .digest("hex"),
      item.sha256,
      "fixture mismatch: " + item.file,
    );
  }
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  for (const tarball of auditManifest.tarballs) {
    const bytes = await readFile(join("/tarballs", tarball.file));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), tarball.sha256);
    assert.equal(
      lock.packages["node_modules/" + tarball.name].integrity,
      "sha512-" + createHash("sha512").update(bytes).digest("base64"),
      "installed tarball integrity: " + tarball.name,
    );
  }
  env.manifestSha256 = process.env.AUDIT_MANIFEST_SHA256;
  env.tarballs = auditManifest.tarballs;
  assert.equal(process.platform, "linux");
  assert.match(process.version, /^v24\./);
  for (const name of ["reactivity", "runtime", "compiler", "router", "kit", "devtools"]) {
    const entry = await realpath(fileURLToPath(import.meta.resolve(`@rivetjs/${name}${["runtime", "devtools"].includes(name) ? "/server" : ""}`)));
    const packageRoot = join(root, "node_modules", "@rivetjs", name);
    assert.ok(entry.startsWith(packageRoot + "/"), `${name} escaped installed tarball: ${entry}`);
    assert.equal(await realpath(packageRoot), packageRoot, "Rivet package must not be a workspace symlink");
    const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    env.packages.push({ name: manifest.name, version: manifest.version, entry });
  }
  for (const name of ["vite", "playwright", "rolldown"]) {
    env.tools[name] = JSON.parse(await readFile(join(root, "node_modules", name, "package.json"), "utf8")).version;
  }
  await writeFile(join(output, "consumer-package-lock.json"), await readFile(join(root, "package-lock.json")));
  env.lockfileSha256 = createHash("sha256")
    .update(await readFile(join(root, "package-lock.json")))
    .digest("hex");
  await writeFile(join(output, "environment.json"), JSON.stringify(env, null, 2));
  for (const sourcemap of [false, true]) {
    const label = sourcemap ? "maps" : "no-maps";
    const dist = join(root, "dist", label);
    const configFile = join(root, "vite.config.ts");
    await writeFile(
      configFile,
      `import { rivetRouter } from "@rivetjs/router/vite"; import { kit } from "@rivetjs/kit/vite"; export default { plugins: [kit(), rivetRouter({ clientRouter: true, devtools: false })], build: { sourcemap: ${sourcemap} } };\n`,
    );
    await build({ root, configFile, logLevel: "warn", build: { outDir: join(dist, "client") } });
    await build({ root, configFile, logLevel: "warn", build: { ssr: true, outDir: join(dist, "server") } });
    const clientRoot = join(dist, "client");
    const entries = await readdir(clientRoot, { recursive: true });
    const jsFiles = entries.filter((f) => /\.m?js$/.test(f));
    const maps = entries.filter((f) => /\.js\.map$/.test(f));
    const scripts = (await Promise.all([...jsFiles, ...maps].map((f) => readFile(join(clientRoot, f), "utf8")))).join("\n");
    await check(`${label}: actual interactive chunks and requested maps exist`, () => {
      assert.ok(jsFiles.length > 0);
      assert.equal(maps.length > 0, sourcemap);
      assert.match(scripts, /PUBLIC_LOADER_CONTROL|PUBLIC_STEP|publicValue/);
    });
    await check(`${label}: server canaries absent from browser chunks and source maps`, () => {
      for (const marker of forbidden) assert.ok(!scripts.includes(marker), `${marker} leaked`);
    });
    // CSP is disabled for parser probes so a policy cannot hide broken escaping.
    const server = await start({ dist, host: "127.0.0.1", port: 0, compress: false, health: false, csp: false, onError });
    let browser;
    try {
      browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      env.chromium = browser.version();
      const context = await browser.newContext();
      context.setDefaultTimeout(10000);
      context.setDefaultNavigationTimeout(15000);
      const page = await context.newPage();
      for (const path of ["/", "/sibling", "/head", "/stream", "/document"]) {
        await check(`${label}: ${path} serves usable production HTML`, async () => {
          const response = await fetch(server.url + path);
          assert.equal(response.status, 200);
          assert.equal(response.headers.has("content-security-policy"), false, "parser probes must not be masked by CSP");
          const html = await response.text();
          for (const marker of forbidden) assert.ok(!html.includes(marker));
          if (path === "/") assert.match(html, /PUBLIC_LOADER_CONTROL/);
          if (path === "/sibling") assert.match(html, /SIBLING_PUBLIC_CONTROL/);
          if (path === "/document") assert.match(html, /PUBLIC_DOCUMENT_CONTROL/);
        });
      }
      await check(`${label}: real public loader data, endpoint and cold click work`, async () => {
        assert.deepEqual(await (await fetch(server.url + "/api/info")).json(), { ready: true });
        const proof = await (await fetch(server.url + "/api/info", { headers: { "x-audit-proof": "1" } })).json();
        assert.equal(proof.privateToken, forbidden[0], "server-only module really executes on the installed package");
        assert.equal(proof.privateHandler, forbidden[4], "stripped endpoint handler really executes on the server");
        const data = await (await fetch(server.url + "/?_rivet=data")).text();
        assert.match(data, /PUBLIC_LOADER_CONTROL/);
        for (const marker of forbidden) assert.ok(!data.includes(marker));
        await page.goto(server.url);
        await page.locator("#count").click();
        await page.waitForFunction(() => document.querySelector("#count")?.textContent === "7");
      });
      for (const path of ["/", "/head", "/stream"]) {
        for (const [vector, payload] of [
          ["script", hostile],
          ["title-svg", '</title><svg id="injected" onload="globalThis.__auditXss=4"></svg>'],
          ["attribute", '\" autofocus onfocus="globalThis.__auditXss=5" data-probe="'],
          ["math", '</style><math><mtext><img id="injected" src=x onerror="globalThis.__auditXss=6"></mtext></math>'],
        ])
          await check(`${label}: ${path} ${vector} remains text without CSP`, async () => {
            await page.goto(server.url + path + "?q=" + encodeURIComponent(payload));
            const selector = path === "/stream" ? "#stream" : "#text";
            await page.waitForSelector(selector);
            assert.equal(await page.locator(selector).textContent(), payload);
            assert.equal(await page.locator("#injected").count(), 0);
            assert.equal(await page.evaluate(() => globalThis.__auditXss), undefined);
            if (path === "/") {
              assert.equal(await page.locator("#attribute").getAttribute("title"), payload);
              await page.locator("#count").click();
              await page.waitForFunction(() => document.querySelector("#count")?.textContent === "7");
              assert.equal(await page.evaluate(() => globalThis.__auditXss), undefined, "payload stays inert after resume");
            }
            if (path === "/head") {
              assert.equal(await page.title(), payload);
              const json = await page.locator('script[type="application/ld+json"]').textContent();
              assert.equal(JSON.parse(json).name, payload);
            }
          });
      }
      for (const payload of [
        "javascript:globalThis.__auditXss=3",
        "java\tscript:globalThis.__auditXss=3",
        "data:text/html,<script>globalThis.__auditXss=3</script>",
      ]) {
        await check(`${label}: URL sanitizer rejects ${payload.split(":")[0]} in HTML and SVG`, async () => {
          await page.goto(server.url + "/?q=" + encodeURIComponent(payload));
          for (const id of ["url", "svg-url"]) {
            const href = await page.locator("#" + id).getAttribute("href");
            assert.equal(href, "about:invalid#rivet", `${id} must neutralize the URL`);
          }
        });
      }
      await check(`${label}: deferred shell arrives before gated payload`, async () => {
        const response = await fetch(server.url + "/stream?gate=controlled&q=" + encodeURIComponent(hostile));
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        while (!text.includes("public shell")) {
          const chunk = await reader.read();
          assert.equal(chunk.done, false);
          text += decoder.decode(chunk.value);
        }
        assert.ok(!text.includes('id="stream"'));
        await fetch(server.url + "/api/release?key=controlled");
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          text += decoder.decode(chunk.value);
        }
        assert.ok(text.includes("stream"));
        assert.ok(!text.includes('<img id="injected"'), "deferred HTML payload remains escaped");
      });
      await check(`${label}: failure after committed shell redacts its exception`, async () => {
        const response = await fetch(server.url + "/late-error?gate=late-controlled");
        assert.equal(response.status, 200);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        while (!text.includes("public shell")) {
          const chunk = await reader.read();
          assert.equal(chunk.done, false);
          text += decoder.decode(chunk.value);
        }
        await fetch(server.url + "/api/release?key=late-controlled");
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          text += decoder.decode(chunk.value);
        }
        assert.match(text, /rivet:resume-error/);
        assert.ok(!text.includes(errors["/late-error"]));
      });
      for (const [path, marker] of Object.entries(errors)) {
        await check(`${label}: ${path} production failure redacts exception content`, async () => {
          const response = await fetch(server.url + path);
          const html = await response.text();
          await writeFile(join(output, `${label}-${path.slice(1)}.html`), html);
          assert.ok(!html.includes(marker), `${marker} leaked into response`);
          if (path !== "/late-error") assert.equal(response.status, 500);
          else {
            assert.match(html, /public shell/);
            assert.match(html, /rivet:resume-error/);
          }
          const answer = await (await fetch(server.url + path + "?_rivet=data")).text();
          assert.ok(!answer.includes(marker), `${marker} leaked into data response`);
        });
      }
      await context.close();
    } finally {
      try {
        await browser?.close();
      } finally {
        await server.close();
      }
    }
    const secured = await start({ dist, host: "127.0.0.1", port: 0, compress: false, health: false, onError });
    let browserCSP;
    try {
      browserCSP = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      await check(`${label}: nonce CSP permits resume and blocks unauthorized inline script`, async () => {
        const page = await browserCSP.newPage();
        const document = await fetch(secured.url);
        const headers = Object.fromEntries(document.headers);
        delete headers["content-length"];
        assert.match(headers["content-security-policy"], /nonce-/);
        const html = await document.text();
        const nonce = /<script[^>]* nonce="([^" ]+)"/.exec(html)?.[1];
        assert.ok(nonce, "the production document has an authorized script nonce");
        // A parser-inserted attack is distinct from code injected through DevTools' evaluate API.
        const injected = html.replace("</head>", `<script>globalThis.__denied=1</script><script nonce="${nonce}">globalThis.__allowed=1</script></head>`);
        await page.route(secured.url + "/", (route) => route.fulfill({ status: 200, headers, body: injected }));
        await page.goto(secured.url);
        await page.locator("#count").click();
        await page.waitForFunction(() => document.querySelector("#count")?.textContent === "7");
        assert.equal(await page.evaluate(() => globalThis.__denied), undefined);
        assert.equal(await page.evaluate(() => globalThis.__allowed), 1);
      });
    } finally {
      try {
        await browserCSP?.close();
      } finally {
        await secured.close();
      }
    }
    const hashes = await Promise.all(
      [...jsFiles, ...maps].map(async (file) => ({
        file,
        sha256: createHash("sha256")
          .update(await readFile(join(clientRoot, file)))
          .digest("hex"),
      })),
    );
    await writeFile(join(output, `${label}-client-files.json`), JSON.stringify(hashes, null, 2));
  }
  await staticCases({ root, check, hostile, forbidden });
} catch (error) {
  infrastructure = String(error.stack ?? error);
  console.error(infrastructure);
}
const report = {
  environment: env,
  checks: results,
  passed: results.filter((x) => x.pass).length,
  failed: results.filter((x) => !x.pass).length,
  infrastructure,
  serverErrors,
};
await writeFile(join(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ passed: report.passed, failed: report.failed, infrastructure: !!infrastructure }));
process.exitCode = infrastructure ? 2 : report.failed ? 1 : 0;
