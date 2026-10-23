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
    // The loader is an arrow inside `load(…)`: its frame is anonymous, at the throw line.
    assert.match(html, /<pre class="stack">Error: loader &lt;exploded&gt;\n\s+at [^\n]*crash\.server\.ts:3:\d+/);
    // The page opens Vite's overlay itself (the ws message only reaches pages already open), nonce'd for the CSP.
    const nonce = /'nonce-([^']+)'/.exec(response.headers.get("content-security-policy")!)![1]!;
    assert.match(html, new RegExp(`<script type="module" nonce="${nonce.replace(/[+/]/g, "\\$&")}">import \\{ ErrorOverlay \\} from "/@vite/client";`));
    assert.ok(!html.includes("<exploded>"), "message is escaped");

    const errors = sent.filter((payload) => payload.type === "error");
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.err!.plugin, "rivet");
    assert.equal(errors[0]!.err!.message, 'loader failed in route "crash": loader <exploded>');
    assert.match(errors[0]!.err!.stack, /crash\.server\.ts:3:\d+/);
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

test("dev: the resume recorder runs; a class instance captured by a handler is rebuilt in the browser, no failure", async () => {
  const restoreEnv = nodeEnv("development");
  const { server, origin, sent } = await devServer(root, configFile);
  try {
    // Recorded like production: boundary markers and the boundaries tail in the HTML.
    const home = await (await fetch(origin + "/")).text();
    assert.match(home, /<div data-rivet-routes=""><!--\[--><h1 id="home">Home<\/h1><!--\]--><\/div>/);
    assert.match(home, /<script type="rivet\/boundaries"/);

    // Derived model: captures are not serialized (the browser re-runs the component), so a class instance is no error.
    const response = await fetch(origin + "/unserializable");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<button id="greet"[^>]*>Hi <!--\[-->0<!--\]--><\/button>/);
    assert.match(html, /<script type="rivet\/boundaries"/);
    assert.ok(!html.includes("rivet dev: render failed"), html);
    assert.equal(sent.filter((payload) => payload.type === "error").length, 0);
  } finally {
    await server.close();
    restoreEnv();
  }
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
    assert.match(page.replace(/<!--\[-->|<!--\]-->/g, ""), /<h1 id="not-found">Nothing at \/missing<\/h1>/);
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
