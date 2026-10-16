// Critical CSS (docs-kit tools/critical-css.ts) in Chromium on the BUILT site: with the full stylesheets blocked, the
// page and the overlays its first click opens (theme menu, mobile drawer: DOM that is not in the HTML, declared in
// docs-kit CLIENT_SELECTORS) have the same computed styles as with the full stylesheets.
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser } from "playwright";

const client = resolve(fileURLToPath(new URL("..", import.meta.url)), "dist/client");
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
let server: Server;
let origin: string;
let browser: Browser;

beforeAll(async () => {
  server = createServer((req, res) => {
    let path = resolve(client, "." + decodeURIComponent(new URL(req.url!, "http://x").pathname));
    if (existsSync(path) && !path.includes(".", path.lastIndexOf("/"))) path = resolve(path, "index.html");
    if (!existsSync(path)) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[path.slice(path.lastIndexOf("."))] ?? "application/octet-stream" }).end(readFileSync(path));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  await new Promise((done) => server?.close(done));
});

const PROPS = ["display", "position", "width", "height", "margin", "padding", "color", "background-color", "font-size", "font-weight", "line-height", "border", "border-radius", "gap", "opacity", "visibility", "box-shadow", "z-index", "overflow"];

/** Computed styles of `root`'s subtree (outside `[data-css-defer]`) after `open` (a click), full sheets blocked or not. */
async function styles(path: string, width: number, critical: boolean, open?: { click: string; root: string }): Promise<string[]> {
  const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: "reduce" });
  try {
    // Blocked = the moment between the first paint and the full sheets' arrival (the shell turns them on after paint).
    if (critical) await page.route(/\/assets\/.*\.css$/, (route) => (route.request().frame() === page.mainFrame() ? route.abort() : route.continue()));
    const response = await page.goto(origin + path, { waitUntil: "load" });
    assert.equal(response?.status(), 200);
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-rivet-critical")), true, "page carries critical CSS");
    // The self-hosted fonts now swap on the first visit. Compare both CSS paths with the same loaded faces.
    await page.evaluate(() => document.fonts.ready);
    if (open) {
      await page.click(open.click);
      await page.waitForSelector(open.root, { state: "visible" });
      await page.waitForTimeout(400);
    }
    return await page.evaluate(
      ({ props, root }) =>
        [...document.querySelectorAll(root ? `${root}, ${root} *` : "body *")]
          .filter((el) => !el.closest("[data-css-defer]"))
          .map((el) => {
            const cs = getComputedStyle(el);
            return `${el.tagName.toLowerCase()}.${typeof el.className === "string" ? el.className : ""} ` + props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
          }),
      { props: PROPS, root: open?.root },
    );
  } finally {
    await page.close();
  }
}

async function parity(path: string, width: number, open?: { click: string; root: string }) {
  const [critical, full] = [await styles(path, width, true, open), await styles(path, width, false, open)];
  assert.ok(full.length > 0);
  assert.equal(critical.length, full.length);
  const diffs = critical.flatMap((line, i) => (line === full[i] ? [] : [`critical ${line}\n    full ${full[i]}`]));
  assert.deepEqual(diffs.slice(0, 5), [], `${path} @${width}${open ? " " + open.root : ""}: ${diffs.length} elements differ`);
}

test("content page: computed styles equal with critical CSS only and with the full sheets (412 / 1350 px)", async () => {
  await parity("/learn/resuming/", 412);
  await parity("/learn/resuming/", 1350);
});

test("overlays opened by the first click (theme menu, mobile drawer) are styled before the full sheets arrive", async () => {
  await parity("/learn/resuming/", 1350, { click: ".theme-button", root: ".menu-popover" });
  await parity("/learn/resuming/", 412, { click: ".menu-button", root: ".drawer" });
});
