// Homepage contracts on the BUILT site. Motion-specific coverage lives in home-studio.test.ts.
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

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

async function home(options: { reducedMotion?: "reduce" | "no-preference"; width?: number; height?: number } = {}): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: options.width ?? 1300, height: options.height ?? 850 },
    reducedMotion: options.reducedMotion ?? "no-preference",
  });
  await page.goto(origin + "/", { waitUntil: "load" });
  return page;
}

test("home headline: full sentence as the accessible name, first word painted, words cycle without layout shift", async () => {
  const page = await home();
  try {
    const heading = page.getByRole("heading", { level: 1 });
    assert.equal(await heading.getAttribute("id"), "lp-title");
    assert.equal(await heading.getAttribute("aria-label"), "Make the web feel alive, fast and fluid.");
    assert.equal(await page.locator(".hs-word").textContent(), "alive.");
    assert.equal(await page.locator(".hs-title-line").getAttribute("aria-hidden"), "true");
    await page.evaluate(() => document.fonts.ready);
    const box = async () => page.locator("h1").evaluate((h1) => [h1.getBoundingClientRect().width, h1.getBoundingClientRect().height]);
    const size = await box();
    for (const word of ["fast.", "fluid.", "alive."]) {
      await page.waitForFunction((text) => document.querySelector(".hs-word")?.textContent === text, word, { timeout: 6000 });
      assert.deepEqual(await box(), size, `h1 box unchanged for ${word}`);
    }
  } finally {
    await page.close();
  }
});

test("home headline: keyboard pause control and reduced motion keep the first word static", async () => {
  const page = await home();
  try {
    const pause = page.locator(".hs-word-pause");
    await pause.focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.querySelector(".hs-word-pause")?.getAttribute("aria-pressed") === "true");
    const word = await page.locator(".hs-word").textContent();
    await page.waitForTimeout(3400);
    assert.equal(await page.locator(".hs-word").textContent(), word);
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.querySelector(".hs-word-pause")?.getAttribute("aria-pressed") === "false");
  } finally {
    await page.close();
  }
  const reduced = await home({ reducedMotion: "reduce" });
  try {
    await reduced.waitForLoadState("networkidle");
    await reduced.evaluate(() => document.fonts.ready);
    // Deferred sheets can create the reduced-motion 0.01ms transitions for one frame as they arrive.
    await reduced.waitForFunction(() => document.getAnimations().filter((a) => a.playState === "running").length === 0, undefined, { timeout: 5000 });
    assert.equal(await reduced.locator(".hs-word").textContent(), "alive.");
    assert.ok(!(await reduced.locator(".hs-word-pause").isVisible()), "no pause control without motion");
  } finally {
    await reduced.close();
  }
});

test("home hero: the command box copies `npm create rivet@latest`; no horizontal scroll on a phone", async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await context.newPage();
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375, "no horizontal page scroll at 375 px");
    const command = page.locator(".hs-hero .hs-command");
    assert.equal(await command.locator("pre").textContent(), "npm create rivet@latest");
    await command.getByRole("button").click();
    await page.waitForFunction(() => document.querySelector(".hs-command .copy-button")?.hasAttribute("data-copied"));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "npm create rivet@latest");
    assert.equal(await page.locator('.hs-hero-actions a[href="/start/what-is-rivet/"]').textContent(), "Explore the docs");
    assert.ok(await page.locator('.hs-hero a[href="/start/quick-start/"]').isVisible());
  } finally {
    await context.close();
  }
});
test("home: visible animations load before input, generic docs highlighter and search stay lazy", async () => {
  for (const width of [1300, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (["script", "fetch", "xhr"].includes(request.resourceType()) || /\.m?js(\?|$)/.test(request.url())) scripts.push(request.url());
    });
    try {
      await page.goto(origin + "/", { waitUntil: "load" });
      await page.waitForTimeout(1500); // idle-time prefetches would have started by now
      assert.ok(scripts.some((url) => url.includes("HomeCanvas")), `visible canvas really started at width ${width}`);
      assert.ok(!scripts.some((url) => /pagefind|SearchDialog|highlight/i.test(url)), `no generic docs eager code: ${scripts.join(", ")}`);
      const settled = scripts.length;
      await page.waitForTimeout(1200);
      assert.equal(scripts.length, settled, "continuous motion does not repeatedly download code");
      const preloads = await page.locator('link[rel="modulepreload"]').evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
      for (const url of preloads) assert.ok(scripts.includes(url), `modulepreload belongs to code actually used by visible effects: ${url}`);
    } finally {
      await page.close();
    }
  }
});

test("home numbers: four readable final values in view, below the fold, print and reduced motion", async () => {
  const page = await home();
  try {
    const counts = await page.locator(".hs-stats data").evaluateAll((nodes) => nodes.map((n) => [n.getAttribute("value"), n.textContent]));
    assert.equal(counts.length, 4);
    for (let index = 0; index < 4; index++) {
      const chart = page.locator(".hs-stats li").nth(index);
      await chart.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().bottom + scrollY - innerHeight + 20));
      await page.waitForTimeout(100);
      const state = await chart.evaluate((el) => {
        const cu = el.querySelector<HTMLElement>("data")!;
        return {
          n: cu.textContent!.replace("×", ""),
          to: cu.getAttribute("value"),
          visible: getComputedStyle(cu).opacity === "1",
        };
      });
      assert.equal(state.n, state.to, `chart ${index}: counter at its value`);
      assert.ok(state.visible, `stat ${index}: real text visible`);
    }
  } finally {
    await page.close();
  }
  // Complete at rest: charts not scrolled to yet (full-page captures, link previews) and print show the real values.
  // A short viewport keeps every chart below the fold (at 850 px the 2nd row straddles it: its view timeline runs).
  const rest = await home({ height: 400 });
  try {
    const tops = await rest.locator(".hs-stats li").evaluateAll((charts) => charts.map((chart) => chart.getBoundingClientRect().top - innerHeight));
    assert.ok(tops.every((below) => below > 0), `every chart below the fold: ${tops.join(", ")}`);
    const atRest = () =>
      rest.locator(".hs-stats li").evaluateAll((charts) =>
        charts.map((chart) => {
          const cu = chart.querySelector<HTMLElement>("data")!;
          return {
            shown: cu.textContent!.replace("×", "") === cu.getAttribute("value"),
            visible: getComputedStyle(cu).opacity === "1",
          };
        }),
      );
    for (const state of await atRest()) assert.deepEqual(state, { shown: true, visible: true }, "below the fold, before any scroll");
    await rest.emulateMedia({ media: "print" });
    const printed = await rest.locator(".hs-stats data").evaluateAll((nodes) => nodes.map((n) => [getComputedStyle(n).color !== "rgba(0, 0, 0, 0)", getComputedStyle(n, "::after").content]));
    for (const [visible, after] of printed) assert.ok(visible && after === "none", `print shows the <data> text (${after})`);
  } finally {
    await rest.close();
  }
  const reduced = await home({ reducedMotion: "reduce" });
  try {
    const colors = await reduced.locator(".hs-stats data").evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).color));
    for (const color of colors) assert.notEqual(color, "rgba(0, 0, 0, 0)", "real number text shows");
    // The deferred sheets can start reduced-motion 0.01ms transitions just after load: wait for them to have loaded
    // (CI: they landed after a first zero, 658 animations at the assertion).
    await reduced.waitForLoadState("networkidle");
    await reduced.waitForFunction(() => document.getAnimations().filter((a) => a.playState === "running").length === 0);
  } finally {
    await reduced.close();
  }
});

test("home proof: four linked chart summaries and every section readable at rest", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    const strip = await page.locator(".hs-stats a").evaluateAll((links) =>
      links.map((a) => ({ href: a.getAttribute("href"), bottom: a.getBoundingClientRect().bottom, text: a.textContent })),
    );
    assert.equal(strip.length, 4);
    for (const item of strip) {
      const response = await page.request.get(origin + item.href!);
      assert.equal(response.status(), 200, `linked chart page ${item.href} exists`);
      assert.ok((await response.text()).includes(`id="${item.href!.split("#")[1]}"`), `chart anchor ${item.href} exists`);
    }
    const bigs = strip.map((item) => /^[\d.]+×/.exec(item.text!)?.[0]);
    for (let i = 1; i < bigs.length; i++) assert.notEqual(bigs[i], bigs[i - 1], `no two equal ratios side by side: ${bigs}`);
    // No scroll reveal: sections below the fold are fully opaque before they are scrolled to.
    const faded = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".hs-section, .hs-directory")].filter((el) => getComputedStyle(el).opacity !== "1" || getComputedStyle(el).translate !== "none").map((el) => el.className),
    );
    assert.deepEqual(faded, []);
  } finally {
    await page.close();
  }
});

/** Actual script resources, used to separate visible-animation startup from later input downloads. */
const scriptsNow = (page: Page) => page.evaluate(() => performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname).filter((path) => path.endsWith(".js")));

test("resume counter: server HTML contains the value; adoption and repeated clicks keep the server's elements", async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { serverButton?: Element | null }).serverButton = document.querySelector('[aria-label="Increment counter"]');
    }, { once: true });
  });
  try {
    const response = await page.goto(origin + "/", { waitUntil: "load" });
    assert.match(await response!.text(), /id="home-counter-value"[^>]*>[^]*?07/);
    assert.equal(await page.locator("#home-counter-value").textContent(), "07");
    const button = page.getByRole("button", { name: "Increment counter", exact: true });
    for (let i = 0; i < 3; i++) await button.click();
    await page.waitForFunction(() => document.querySelector("#home-counter-value")?.textContent === "10");
    assert.ok(await page.evaluate(() => (window as unknown as { serverButton?: Element }).serverButton === document.querySelector('[aria-label="Increment counter"]')), "the server's button was adopted, not re-created");
  } finally {
    await page.close();
  }
});

test("resume counter: an earlier theme interaction leaves the counter working without duplicate downloads", async () => {
  const page = await home();
  try {
    await page.getByRole("button", { name: "Theme", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Escape");
    const prior = await scriptsNow(page);
    assert.ok(prior.some((name) => /\/ThemeMenu-/.test(name)), `the theme was really loaded before the counter: ${prior.join(", ")}`);
    await page.getByRole("button", { name: "Increment counter", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#home-counter-value")?.textContent === "08");
    await page.waitForLoadState("networkidle");
    const after = await scriptsNow(page);
    for (const path of prior) assert.equal(after.filter((item) => item === path).length, 1, `${path} was not downloaded again`);
  } finally {
    await page.close();
  }
});

test("resume counter: after a hover, the first click paints within 100 ms on slow 4G + 4x CPU", async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const button = page.getByRole("button", { name: "Increment counter", exact: true });
    await button.scrollIntoViewIfNeeded();
    await button.hover();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const w = window as unknown as { paint?: number; down?: number };
      document.addEventListener("pointerdown", (event) => (w.down = event.timeStamp), { capture: true, once: true });
      new MutationObserver((_, observer) => {
        observer.disconnect();
        requestAnimationFrame(() => setTimeout(() => (w.paint = performance.now())));
      }).observe(document.querySelector("#home-counter-value")!, { childList: true, characterData: true, subtree: true });
    });
    await button.click();
    const ms = await page.waitForFunction(() => {
      const w = window as unknown as { paint?: number; down?: number };
      return w.paint !== undefined && w.down !== undefined && w.paint - w.down;
    });
    const elapsed = (await ms.jsonValue()) as number;
    // The homepage claim's budget: enforced off CI (4x throttling on CI's runners: 176–482 ms; root vitest.config.ts
    // PERF_BUDGETS).
    if (!process.env.CI || process.env.RIVET_PERF_BUDGETS === "1") assert.ok(elapsed <= 100, `pointerdown → paint ${elapsed.toFixed(1)} ms`);
    assert.equal(await page.locator("#home-counter-value").textContent(), "08");
  } finally {
    await page.close();
  }
});

test("component workbench: focusing server controls keeps their markup and box; keyboard tabs and input work, no axe violations", async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 }, bypassCSP: true });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    await page.locator(".hs-workbench").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const snapshot = () =>
      page.evaluate(() => {
        const panel = document.querySelector(".hs-workbench")!;
        const box = panel.getBoundingClientRect();
        return { controls: [...panel.querySelectorAll("button")].map((el) => [el.className, el.getAttribute("role"), el.getAttribute("aria-label"), el.textContent]), box: [box.x, box.y, box.width, box.height] };
      });
    const before = await snapshot();
    await page.getByRole("tab", { name: "Component", exact: true }).focus();
    await page.waitForLoadState("networkidle");
    const after = await snapshot();
    assert.deepEqual(after, before, "server and adopted controls retain markup and geometry on focus");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement?.id === "home-tab-server");
    assert.ok(await page.locator("#home-code-server").isVisible());
    await page.keyboard.press("Home");
    await page.waitForFunction(() => document.activeElement?.id === "home-tab-component");
    await page.getByRole("button", { name: "Increment counter", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#home-counter-value")?.textContent === "08");
    await page.addScriptTag({ path: resolve(fileURLToPath(new URL("../../..", import.meta.url)), "node_modules/axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: string) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
      return (await axe.run(".hs-workbench")).violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
    });
    assert.deepEqual(violations, []);
  } finally {
    await page.close();
  }
});

test("component workbench: a pointer can select server HTML; the initial server panel has no axe violations", async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 }, bypassCSP: true });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    await page.locator(".hs-workbench").scrollIntoViewIfNeeded();
    await page.addScriptTag({ path: resolve(fileURLToPath(new URL("../../..", import.meta.url)), "node_modules/axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: string) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
      return (await axe.run(".hs-workbench")).violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
    });
    assert.deepEqual(violations, [], "preview");
    await page.getByRole("tab", { name: "Server HTML", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#home-tab-server")?.getAttribute("aria-selected") === "true");
    assert.ok(await page.locator("#home-code-server").isVisible());
    assert.ok(!(await page.locator("#home-code-component").isVisible()));
  } finally {
    await page.close();
  }
});

test("footer: reference links remain available and the animated homepage makes no obsolete zero-startup-JS claim", async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    await page.locator("footer").scrollIntoViewIfNeeded();
    for (const href of ["/api/", "/examples/", "/search/"]) assert.ok(await page.locator(`footer a[href="${href}"]`).isVisible());
    assert.doesNotMatch(await page.locator(".hs-home").innerText(), /no script files before you interact|JS loaded with the page: 0 B/);
    await page.waitForLoadState("networkidle");
    assert.ok((await scriptsNow(page)).length > 0, "visible Motion/canvas code really runs with the page");
  } finally {
    await page.close();
  }
});
