// Dev server error surfaces: server failures reach Vite's overlay (ws) and a dev error page with the
// stack, unmatched URLs list the routes, browser route errors are forwarded to the overlay; the
// production build answers the same failures with a generic message and a digest.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { build, createServer, type ViteDevServer } from "vite";
import { chromium } from "playwright";
import { start } from "../adapters/node.ts";
import type { ErrorInfo } from "../server/handler.ts";
import { devReport } from "../build/dev-errors.ts";
import { nodeEnv, withNodeEnv } from "./vite-env.ts";

const root = new URL("./fixture-dev/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";
const withErrorView = new URL("./fixture/", import.meta.url).pathname;

type Payload = { type: string; err?: { message: string; stack: string; plugin: string; id?: string } };
async function devServer(at: string, file: string): Promise<{ server: ViteDevServer; origin: string; sent: Payload[] }> {
  const server = await createServer({ root: at, configFile: file, logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const sent: Payload[] = [];
  const send = server.ws.send.bind(server.ws) as (payload: Payload) => void;
  (server.ws as { send: unknown }).send = (payload: Payload) => (sent.push(payload), send(payload));
  return { server, origin: server.resolvedUrls!.local[0]!.replace(/\/$/, ""), sent };
}

test("dev: a loader throw sends the overlay error and renders the dev error page with stack, route and phase", async () => {
  const restoreEnv = nodeEnv("development");
  const { server, origin, sent } = await devServer(root, configFile);
  try {
    const response = await fetch(origin + "/crash");
    assert.equal(response.status, 500);
    assert.match(response.headers.get("content-type")!, /^text\/html/);
    const html = await response.text();
    assert.match(html, /<h1>Server error<\/h1>/);
    assert.match(html, /<p id="rivet-dev-where">Route <code>crash<\/code>, phase <code>loader<\/code><\/p>/);
    // Escaped message; the stack is source-mapped to the route's server module.
    assert.match(html, /<pre class="message">loader &lt;exploded&gt;<\/pre>/);
    assert.match(html, /<pre class="stack">Error: loader &lt;exploded&gt;\n\s+at (?:Object\.)?load \([^)]*crash\.server\.ts:2:\d+\)/);
    // The page opens Vite's overlay itself (the ws message only reaches pages already open), nonce'd for the CSP.
    const nonce = /'nonce-([^']+)'/.exec(response.headers.get("content-security-policy")!)![1]!;
    assert.match(html, new RegExp(`<script type="module" nonce="${nonce.replace(/[+/]/g, "\\$&")}">import \\{ ErrorOverlay \\} from "/@vite/client";`));
    assert.ok(!html.includes("<exploded>"), "message is escaped");

    const errors = sent.filter((payload) => payload.type === "error");
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.err!.plugin, "rivet");
    assert.equal(errors[0]!.err!.message, 'loader failed in route "crash": loader <exploded>');
    assert.match(errors[0]!.err!.stack, /crash\.server\.ts:2:\d+/);
    assert.equal(errors[0]!.err!.id, join(root, "src/routes/crash.tsx"));

    // Client navigation (data request): JSON as before, the overlay message goes out again.
    const data = await fetch(origin + "/crash?_rivet=data", { headers: { accept: "application/json" } });
    assert.equal(data.status, 500);
    assert.match(data.headers.get("content-type")!, /^application\/json/);
    assert.match(await data.text(), /loader <exploded>/);
    assert.equal(sent.filter((payload) => payload.type === "error").length, 2);
  } finally {
    await server.close();
    restoreEnv();
  }
});

test("dev: the resume recorder runs; a non-serializable capture names its component, source and capture in the overlay", async () => {
  const restoreEnv = nodeEnv("development");
  const { server, origin, sent } = await devServer(root, configFile);
  try {
    // Recorded like production: ids and markers in the HTML.
    const home = await (await fetch(origin + "/")).text();
    assert.match(home, /<div data-rivet-routes=""><!--r0\[--><h1 id="home">Home<\/h1><!--\]--><\/div>/);

    // The state encodes after the shell (status sent): the body ends with the hint and the overlay script.
    const response = await fetch(origin + "/unserializable");
    assert.equal(response.status, 200);
    const html = await response.text();
    // Symbol ids are content hashes (`Greeter$<6 base-36>`): read the handler's id from the hint.
    const id = /src\/routes\/unserializable\.tsx#Greeter\$[0-9a-z]{3,13}/.exec(html)?.[0] ?? "<no symbol id>";
    const where = "in <Greeter> (src/routes/unserializable.tsx:8:1), event handler " + id;
    const capture = "capture `session` (src/routes/unserializable.tsx:10:9)";
    assert.match(
      html,
      /<!-- rivet dev: render failed in route "unserializable": Cannot resume src\/routes\/unserializable\.tsx#Greeter\$[0-9a-z]{3,13}: capture `session` Session instance is not serializable/,
    );
    // The document closed cleanly before the hint: the failure marker for the page's own listeners.
    assert.match(html, /<script nonce="[^"]+">document\.dispatchEvent\(new CustomEvent\("rivet:resume-error",\{detail:\{"phase":"render","digest":"[\da-f]+"/);
    assert.ok(html.includes(where) && html.includes(capture), html);
    assert.match(html, /import \{ ErrorOverlay \} from "\/@vite\/client";/);
    assert.match(html, /hot\.on\("vite:beforeUpdate", \(\) => location\.reload\(\)\)/);
    assert.ok(!html.includes('type="rivet/state"'), "no state after the failure");

    const errors = sent.filter((payload) => payload.type === "error");
    assert.equal(errors.length, 1);
    const err = errors[0]!.err! as { message: string; id?: string; loc?: { file: string; line: number; column: number } };
    assert.ok(err.message.startsWith('render failed in route "unserializable": Cannot resume ' + id), err.message);
    assert.ok(err.message.includes(where) && err.message.includes(capture), err.message);
    assert.equal(err.id, join(root, "src/routes/unserializable.tsx"));
    assert.deepEqual(err.loc, { file: join(root, "src/routes/unserializable.tsx"), line: 8, column: 1 });
  } finally {
    await server.close();
    restoreEnv();
  }
});

test("dev: a member-narrowed capture is named as written (`o.a`) in the message and the overlay", async () => {
  const restoreEnv = nodeEnv("development");
  const { server, origin, sent } = await devServer(root, configFile);
  try {
    const html = await (await fetch(origin + "/unserializable-member")).text();
    const id = /src\/routes\/unserializable-member\.tsx#Panel\$[0-9a-z]{3,13}/.exec(html)?.[0] ?? "<no symbol id>";
    // The internal parameter name (`o$a`) never shows; the overlay locates the capture at its object's declaration.
    assert.match(html, /Cannot resume src\/routes\/unserializable-member\.tsx#Panel\$[0-9a-z]{3,13}: capture `o\.a` Session instance is not serializable/);
    assert.ok(!html.includes("o$a"), html);
    const capture = "capture `o.a` (src/routes/unserializable-member.tsx:10:9)";
    assert.ok(html.includes("in <Panel> (src/routes/unserializable-member.tsx:8:1), event handler " + id) && html.includes(capture), html);
    const errors = sent.filter((payload) => payload.type === "error");
    assert.equal(errors.length, 1);
    assert.ok((errors[0]!.err! as { message: string }).message.includes(capture));
  } finally {
    await server.close();
    restoreEnv();
  }
});

test("dev report: a symbol the dev manifest has no chunk for gets a dev note", () => {
  const sent: Payload[] = [],
    logged: string[] = [];
  const fake = {
    ssrFixStacktrace() {},
    config: { logger: { error: (text: string) => logged.push(text) }, server: { hmr: true } },
    ws: { send: (payload: Payload) => sent.push(payload) },
  } as unknown as ViteDevServer;
  const report = devReport(
    fake,
    () => ({ routes: [] }),
    "/app/src/routes",
    () => undefined,
  );
  report(new Error("Resume manifest has no chunk for src/widget.tsx#Widget$0 — the client build's …"), new Request("http://x/"));
  assert.match(
    sent[0]!.err!.message,
    /no chunk for src\/widget\.tsx#Widget\$0[^\n]*\n  dev: no module the dev server compiled in resume mode defines src\/widget\.tsx#Widget\$0 \(is src\/widget\.tsx in resume\.modules\?\)/,
  );
  assert.equal(sent[0]!.err!.id, undefined);
  assert.match(logged[0]!, /dev: no module/);
});

test("dev: an app with an `_error` view renders it, with the overlay and a hint comment on top", async () => {
  const restoreEnv = nodeEnv("development");
  const { server, origin, sent } = await devServer(withErrorView, withErrorView + "vite.config.ts");
  try {
    const response = await fetch(origin + "/broken");
    assert.equal(response.status, 500);
    const html = await response.text();
    assert.match(html, /<h1 id="failure">Something failed<\/h1>/);
    assert.match(html, /<!-- rivet dev: loader failed in route "broken": database exploded -->/);
    assert.match(html, /import \{ ErrorOverlay \} from "\/@vite\/client";/);
    assert.ok(html.indexOf("ErrorOverlay") < html.lastIndexOf("</body>"));
    assert.equal(sent.filter((payload) => payload.type === "error").length, 1);
    // A `_404` renders as before, plus a comment listing the routes.
    const missing = await fetch(origin + "/missing");
    assert.equal(missing.status, 404);
    const page = await missing.text();
    assert.match(page, /<h1 id="not-found">Nothing at \/missing<\/h1>/);
    assert.match(page, /<!-- rivet dev: no route matches \/missing\. Routes: .*\/items\/:id.* \/ -->/);
  } finally {
    await server.close();
    restoreEnv();
  }
});

test("dev: an unmatched URL without `_404` lists the route patterns", async () => {
  const restoreEnv = nodeEnv("development");
  const { server, origin } = await devServer(root, configFile);
  try {
    const response = await fetch(origin + "/nowhere/<x>");
    assert.equal(response.status, 404);
    const html = await response.text();
    assert.match(html, /<h1>No route matches <code>\/nowhere\/%3Cx%3E<\/code><\/h1>/);
    const list = /<ul id="rivet-dev-routes">(.*?)<\/ul>/.exec(html)![1]!;
    assert.match(list, /<li><a href="\/"><code>\/<\/code><\/a><\/li>/);
    assert.match(list, /<li><a href="\/about"><code>\/about<\/code><\/a><\/li>/);
    // Parameter patterns are listed without a link; endpoints are marked.
    assert.match(list, /<li><code>\/items\/:id<\/code><\/li>/);
    assert.match(list, /<li><code>\/api\/ping<\/code> <small>endpoint<\/small><\/li>/);
    // A loader's 404 for a matched route is not the unmatched page.
    assert.equal((await fetch(origin + "/about")).status, 200);
  } finally {
    await server.close();
    restoreEnv();
  }
});

test("dev: browser render errors and failed route loads open the overlay", async () => {
  const restoreEnv = nodeEnv("development");
  const { server, origin } = await devServer(root, configFile);
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const page = await browser.newPage();
    const overlay = () => page.evaluate(() => document.querySelector("vite-error-overlay")?.shadowRoot?.textContent ?? null);
    const waitOverlay = async (text: string) => {
      await page.waitForFunction((text) => document.querySelector("vite-error-overlay")?.shadowRoot?.textContent?.includes(text), text, { timeout: 10_000 });
      return (await overlay())!;
    };
    // Full page load of a failing route: the page opens the overlay itself.
    await page.goto(origin + "/crash");
    assert.match(await waitOverlay("loader <exploded>"), /loader failed in route "crash"/);

    // A serialization failure after the response started: the truncated page opens it too, with the source location.
    await page.goto(origin + "/unserializable");
    const text = await waitOverlay("Session instance is not serializable");
    assert.match(text, /in <Greeter> \(src\/routes\/unserializable\.tsx:8:1\)/);
    assert.match(text, /capture `session` \(src\/routes\/unserializable\.tsx:10:9\)/);
    assert.match(text, /unserializable\.tsx:8:1/);

    // Render error during client navigation (no ErrorBoundary): forwarded through the dev entry.
    await page.goto(origin + "/");
    await page.waitForSelector("#home");
    await page.waitForLoadState("networkidle");
    assert.equal(await overlay(), null);
    await page.locator("nav").getByRole("link", { name: "Client boom" }).click();
    assert.match(await waitOverlay("client render exploded"), /Browser error: client render exploded/);

    // Undecodable route data (client-side failure, no HTTP error): the route's failure reaches the overlay.
    await page.goto(origin + "/");
    await page.waitForSelector("#home");
    await page.waitForLoadState("networkidle");
    await page.route(/_rivet=data/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "not json" }));
    await page.locator("nav").getByRole("link", { name: "About" }).click();
    assert.match(await waitOverlay("Browser error"), /JSON/);
  } finally {
    await browser.close();
    await server.close();
    restoreEnv();
  }
});

test("production build: the same failures answer generically, and no dev error code ships", async () => {
  await rm(root + "dist", { recursive: true, force: true });
  await withNodeEnv("production", () => build({ root, configFile, logLevel: "silent" }));
  await withNodeEnv("production", () => build({ root, configFile, logLevel: "silent", build: { ssr: true } }));
  const reported: unknown[] = [];
  // The adapter forwards `onError` to the app, which passes the failure's info (the adapter type shows two parameters).
  const onError = (_error: unknown, _request?: Request, info?: ErrorInfo) => void reported.push(info);
  const app = await start({ dist: root + "dist", port: 0, onError: onError as (error: unknown, request?: Request) => void });
  try {
    const response = await fetch(app.url + "/crash");
    assert.equal(response.status, 500);
    const html = await response.text();
    assert.match(html, /Internal Server Error \(digest [0-9a-f]{10}\)|Something went wrong/);
    assert.ok(!html.includes("exploded") && !html.includes("ErrorOverlay") && !html.includes("rivet-dev"), html);
    // `onError` learns where it failed.
    assert.deepEqual(Object.keys(reported[0] as object).sort(), ["digest", "phase", "route"]);
    assert.equal((reported[0] as { phase: string }).phase, "loader");
    assert.equal((reported[0] as { route: string }).route, "crash");
    const data = await (await fetch(app.url + "/crash?_rivet=data")).text();
    assert.match(data, /Internal Server Error \(digest [0-9a-f]{10}\)/);
    assert.ok(!data.includes("exploded"));
    const missing = await (await fetch(app.url + "/nowhere")).text();
    assert.ok(!missing.includes("rivet-dev-routes") && !missing.includes("rivet dev"), missing);

    // Neither the server bundle nor the browser chunks carry the dev overlay or error forwarding
    // (the generated sources do: `import.meta.hot` branches that the build drops).
    const needles = ["rivet:client-error", "AbortError", "ErrorOverlay", "createHotContext", "rivet-dev-routes"];
    const generated = (await readFile(root + ".rivet/app.tsx", "utf8")) + (await readFile(root + ".rivet/entry.dev.tsx", "utf8"));
    for (const needle of needles.slice(0, 2)) assert.ok(generated.includes(needle), needle);
    for (const dir of ["dist/server", "dist/client"]) {
      for (const file of await readdir(root + dir, { recursive: true })) {
        if (!/\.m?js$/.test(file)) continue;
        const code = await readFile(join(root, dir, file), "utf8");
        for (const needle of needles) assert.ok(!code.includes(needle), `${dir}/${file} has ${needle}`);
      }
    }
  } finally {
    await app.close();
  }
});
