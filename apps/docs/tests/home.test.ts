// Homepage checks in Chromium on the BUILT site (nx `docs:test` depends on `docs:build`): the rotating headline
// (CSS only, two cycles, pausable, static under reduced motion, no layout shift).
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { panelSignature } from "../scripts/showcase-preview.ts";

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

/** Opacity of each rotating word after moving every animation to `ms` from its start (all start together). */
const wordsAt = (page: Page, ms: number) =>
  page.evaluate((time) => {
    for (const animation of document.getAnimations().filter((a) => (a as CSSAnimation).animationName === "rw")) {
      animation.pause();
      animation.currentTime = time;
    }
    return [...document.querySelectorAll<HTMLElement>(".rw-word")].map((word) => Number(getComputedStyle(word).opacity));
  }, ms);
const visible = (opacities: number[]) => opacities.flatMap((opacity, index) => (opacity > 0.99 ? [index] : []));

test("home headline: full sentence as the accessible name, first word painted, words cycle and stop on the last", async () => {
  const page = await home();
  try {
    const heading = page.getByRole("heading", { level: 1 });
    assert.equal(await heading.getAttribute("id"), "lp-title");
    assert.equal(
      await page.evaluate(() => document.querySelector("h1")!.querySelector(".sr-only")!.textContent),
      "The JSX framework built to be fast, resumable, dynamic and yours.",
    );
    assert.deepEqual(await page.locator(".rw-word").allTextContents(), ["fast.", "resumable.", "dynamic.", "yours."]);
    assert.equal(await page.locator(".rw-visual").getAttribute("aria-hidden"), "true");
    // 4 words × 2 cycles; the last one stops in its hold (iteration count 1.2).
    const animations = await page.evaluate(() =>
      document.getAnimations().flatMap((a) => ((a as CSSAnimation).animationName === "rw" ? [(a.effect as KeyframeEffect).getComputedTiming().iterations] : [])),
    );
    assert.deepEqual(animations, [2, 2, 2, 1.2]);
    const box = async () => page.locator("h1").evaluate((h1) => [h1.getBoundingClientRect().width, h1.getBoundingClientRect().height]);
    const size = await box();
    // Period 2600 ms; word n holds from n × 2600 − 400 + 400 ms on.
    for (const [time, word] of [
      [100, 0],
      [2700, 1],
      [5300, 2],
      [7900, 3],
      [10500, 0],
      [18300, 3],
      [40000, 3],
    ] as const) {
      assert.deepEqual(visible(await wordsAt(page, time)), [word], `at ${time} ms`);
      assert.deepEqual(await box(), size, `h1 box unchanged at ${time} ms (no layout shift)`);
    }
  } finally {
    await page.close();
  }
});

test("home headline: pause control, hover pause, reduced motion = static first word + word list", async () => {
  const page = await home();
  try {
    const states = () => page.evaluate(() => [...document.querySelectorAll(".rw-word")].map((word) => getComputedStyle(word).animationPlayState));
    assert.deepEqual(await states(), ["running", "running", "running", "running"]);
    const pause = page.getByRole("checkbox", { name: "Pause headline animation" });
    await page.locator(".rw-pause").click();
    // Known (RED-DOCS → STATIC-ZERO D5): the derived loader holds a click inside any boundary range (the router's Root
    // spans the page) and replays the checkbox's toggle once the runtime and the boundary chain loaded, although no
    // handler listens here. Waits for the replayed toggle instead of reading it at once; tighten when records carry live
    // listeners (loader holds only for those).
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>(".rw-pause input")?.checked === true, undefined, { timeout: 10_000 });
    await page.mouse.move(0, 0);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    assert.deepEqual(await states(), ["paused", "paused", "paused", "paused"], "paused by the checkbox, not by hover / focus");
    await pause.focus();
    await page.keyboard.press("Space");
    assert.ok(!(await pause.isChecked()), "keyboard toggles it");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    assert.deepEqual(await states(), ["running", "running", "running", "running"]);
    await page.locator(".rw-title").hover();
    assert.deepEqual(await states(), ["paused", "paused", "paused", "paused"]);
  } finally {
    await page.close();
  }
  const reduced = await home({ reducedMotion: "reduce" });
  try {
    await reduced.waitForLoadState("networkidle");
    await reduced.evaluate(() => document.fonts.ready);
    assert.equal(await reduced.evaluate(() => document.querySelectorAll(".rw-word").length), 4);
    // Deferred sheets can create the reduced-motion 0.01ms transitions for one frame as they arrive.
    await reduced.waitForFunction(() => document.getAnimations().length === 0, undefined, { timeout: 5000 });
    assert.equal(await reduced.evaluate(() => document.getAnimations().length), 0, "no running animations");
    assert.deepEqual(visible(await wordsAt(reduced, 0)), [0]);
    assert.ok(await reduced.locator(".rw-list").isVisible());
    assert.equal(await reduced.locator(".rw-list").textContent(), "fast · resumable · dynamic · yours");
    assert.ok(!(await reduced.locator(".rw-pause").isVisible()), "no pause control without motion");
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
    const command = page.locator(".lp-hero .lp-command");
    assert.equal(await command.locator("pre").textContent(), "npm create rivet@latest");
    await command.getByRole("button").click();
    await page.waitForFunction(() => document.querySelector(".lp-hero .lp-command .copy-button")?.hasAttribute("data-copied"));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "npm create rivet@latest");
    assert.equal(await page.locator('.lp-hero a[href="#numbers"]').textContent(), "See the numbers");
    assert.ok(await page.locator('.lp-hero a[href="/start/quick-start/"]').isVisible());
  } finally {
    await context.close();
  }
});
test("home: only the inline resume loader before input (no script, module or prefetch request)", async () => {
  for (const width of [1300, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (["script", "fetch", "xhr"].includes(request.resourceType()) || /\.m?js(\?|$)/.test(request.url())) scripts.push(request.url());
    });
    try {
      await page.goto(origin + "/", { waitUntil: "load" });
      await page.waitForTimeout(1500); // idle-time prefetches would have started by now
      assert.deepEqual(scripts, [], `width ${width}`);
      assert.equal(await page.evaluate(() => document.querySelectorAll('link[rel="modulepreload"]').length), 0);
    } finally {
      await page.close();
    }
  }
});

test("home numbers: count-up and bars reach their final values in view; reduced motion = final values, no animation", async () => {
  const page = await home();
  try {
    const counts = await page.locator(".lp-chart .cu").evaluateAll((nodes) => nodes.map((n) => [(n as HTMLElement).dataset.digits, n.textContent]));
    assert.equal(counts.length, 4);
    for (let index = 0; index < 4; index++) {
      const chart = page.locator(".lp-chart").nth(index);
      await chart.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().bottom + scrollY - innerHeight + 20));
      await page.waitForTimeout(100);
      const state = await chart.evaluate((el) => {
        const cu = el.querySelector<HTMLElement>(".cu")!;
        return {
          n: getComputedStyle(cu).getPropertyValue("--cu-n").trim(),
          to: cu.style.getPropertyValue("--cu-to"),
          bars: [...el.querySelectorAll(".bars-bar")].map((bar) => getComputedStyle(bar).transform),
        };
      });
      assert.equal(state.n, state.to, `chart ${index}: counter at its value`);
      for (const transform of state.bars) assert.ok(transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)", `chart ${index}: bar at full length (${transform})`);
    }
  } finally {
    await page.close();
  }
  // Complete at rest: charts not scrolled to yet (full-page captures, link previews) and print show the real values.
  // A short viewport keeps every chart below the fold (at 850 px the 2nd row straddles it: its view timeline runs).
  const rest = await home({ height: 400 });
  try {
    const tops = await rest.locator(".lp-chart").evaluateAll((charts) => charts.map((chart) => chart.getBoundingClientRect().top - innerHeight));
    assert.ok(tops.every((below) => below > 0), `every chart below the fold: ${tops.join(", ")}`);
    const atRest = () =>
      rest.locator(".lp-chart").evaluateAll((charts) =>
        charts.map((chart) => {
          const cu = chart.querySelector<HTMLElement>(".cu")!;
          return {
            shown: getComputedStyle(cu).getPropertyValue("--cu-n").trim() === cu.style.getPropertyValue("--cu-to"),
            bars: [...chart.querySelectorAll(".bars-bar")].every((bar) => ["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(getComputedStyle(bar).transform)),
          };
        }),
      );
    for (const state of await atRest()) assert.deepEqual(state, { shown: true, bars: true }, "below the fold, before any scroll");
    await rest.emulateMedia({ media: "print" });
    const printed = await rest.locator(".lp-chart .cu").evaluateAll((nodes) => nodes.map((n) => [getComputedStyle(n).color !== "rgba(0, 0, 0, 0)", getComputedStyle(n, "::after").content]));
    for (const [visible, after] of printed) assert.ok(visible && after === "none", `print shows the <data> text (${after})`);
  } finally {
    await rest.close();
  }
  const reduced = await home({ reducedMotion: "reduce" });
  try {
    const colors = await reduced.locator(".lp-chart .cu").evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).color));
    for (const color of colors) assert.notEqual(color, "rgba(0, 0, 0, 0)", "real number text shows");
    // The deferred sheets can start reduced-motion 0.01ms transitions just after load: wait for them to have loaded
    // (CI: they landed after a first zero, 658 animations at the assertion).
    await reduced.waitForLoadState("networkidle");
    await reduced.waitForFunction(() => document.getAnimations().length === 0);
    assert.equal(await reduced.evaluate(() => document.getAnimations().length), 0);
  } finally {
    await reduced.close();
  }
});

test("home hero: the proof strip is inside the first 900 px and links each chart; every section is readable at rest", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    const strip = await page.locator(".lp-strip a").evaluateAll((links) =>
      links.map((a) => ({ href: a.getAttribute("href"), bottom: a.getBoundingClientRect().bottom, text: a.textContent })),
    );
    assert.equal(strip.length, 4);
    for (const item of strip) {
      assert.ok(item.bottom <= 900, `strip item inside the first viewport: ${item.text} at ${item.bottom}`);
      assert.ok(await page.locator(item.href!).count(), `strip link ${item.href} has its chart`);
    }
    const bigs = strip.map((item) => /^[\d.]+×/.exec(item.text!)?.[0]);
    for (let i = 1; i < bigs.length; i++) assert.notEqual(bigs[i], bigs[i - 1], `no two equal ratios side by side: ${bigs}`);
    // No scroll reveal: sections below the fold are fully opaque before they are scrolled to.
    const faded = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".lp-section, .lp-cta")].filter((el) => getComputedStyle(el).opacity !== "1" || getComputedStyle(el).translate !== "none").map((el) => el.className),
    );
    assert.deepEqual(faded, []);
  } finally {
    await page.close();
  }
});

/** The demo readout after the first click: files + line fetched for the click, and those prefetched before it. */
async function readout(page: Page) {
  await page.waitForFunction(() => document.querySelector(".rd-now .rd-cost")?.textContent);
  const files = async (group: string) => ((await page.locator(`.rd-${group} .rd-files`).textContent()) ?? "").split(" · ").filter(Boolean);
  return {
    now: await files("now"),
    cost: (await page.locator(".rd-now .rd-cost").textContent())!,
    early: await files("early"),
    earlyCost: (await page.locator(".rd-early .rd-cost").textContent())!,
    earlyHidden: await page.locator(".rd-early").evaluate((node) => (node as HTMLElement).hidden),
  };
}

test("resume demo: no script before the click, the readout names exactly the chunks the click fetched, the adopt run keeps the server's elements", async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
  const scripts = new Map<string, number>();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.endsWith(".js")) void response.body().then((body) => scripts.set(url.pathname.slice(url.pathname.lastIndexOf("/") + 1), body.length));
  });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    const demo = page.locator(".rd");
    await demo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    assert.deepEqual([...scripts.keys()], [], "no script request before the first interaction");
    assert.equal(await demo.locator(".rd-where").textContent(), "the server only");
    await page.evaluate(() => ((window as unknown as { serverButton?: Element }).serverButton = document.querySelector(".rd-like button")!));
    const perf = JSON.parse(readFileSync(resolve(client, "../../content/_home-perf.json"), "utf8")) as { loader: { bytes: number; brotli: number } };
    assert.match(await demo.locator(".rd-before dd").textContent() ?? "", new RegExp(`loader only \\(${(perf.loader.bytes / 1000).toFixed(1)} KB inline`));

    await demo.locator("button").click();
    const { now, cost, early, earlyCost } = await readout(page);
    await page.waitForLoadState("networkidle");
    // The demo's code is listed (its module's chunk: the page's adopt run imports it, the boundary's own entry chunk may
    // not be fetched at all).
    assert.ok([...now, ...early].some((name) => /^ResumeDemo-/.test(name)), `the demo's chunk is listed: ${[...now, ...early].join(", ")}`);
    // Every listed file was fetched; the bytes of each group equal the bodies the network delivered.
    const bodies = (names: string[]) => {
      const sizes = names.map((name) => scripts.get(name));
      assert.ok(sizes.every((size) => size !== undefined), `listed but not fetched: ${names.filter((name) => !scripts.has(name)).join(", ")}`);
      return sizes.reduce((sum, size) => sum! + size!, 0)!;
    };
    const decoded = bodies(now);
    assert.match(cost, new RegExp(`^Fetched for this click: ${now.length} files, `));
    assert.match(cost, new RegExp(`\\(${(decoded / 1000).toFixed(1)} KB uncompressed\\), in \\d+ ms$`));
    if (early.length) assert.match(earlyCost, new RegExp(`^Already prefetched before the click: ${early.length} files?, .*\\(${(bodies(early) / 1000).toFixed(1)} KB uncompressed\\)$`));
    else assert.equal(earlyCost, "");
    // Known (RED-DOCS → STATIC-ZERO D5): the click adopts every boundary around the button up to the router's Root (an
    // ancestor's handler might see it bubble; records do not say which listen), so the closure is the home page's whole
    // boundary chain (2026-10-23: 117 files / ~1 MB raw), not the demo alone. The readout reports it as it is.

    await demo.locator("button").click();
    await demo.locator("button").click();
    await page.waitForFunction(() => document.querySelector(".rd-like button")?.textContent === "3 likes");
    // The adopt run ran the component in the browser over the server's elements: same button node, the body's text rewritten.
    assert.equal(await demo.locator(".rd-where").textContent(), "the server, then this tab (on your first click)");
    assert.ok(await page.evaluate(() => (window as unknown as { serverButton?: Element }).serverButton === document.querySelector(".rd-like button")), "the server's button was adopted, not re-created");
  } finally {
    await page.close();
  }
});

test("resume demo: what an earlier theme interaction loaded is reported as loaded before the click, never as fetched for it", async () => {
  const page = await home();
  try {
    await page.getByRole("button", { name: "Theme", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Escape");
    const scriptsNow = () =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((entry) => new URL(entry.name).pathname)
          .filter((path) => path.endsWith(".js"))
          .map((path) => path.slice(path.lastIndexOf("/") + 1)),
      );
    const prior = await scriptsNow();
    assert.ok(prior.some((name) => /^ThemeMenu-/.test(name)), `the theme was really loaded before the demo: ${prior.join(", ")}`);
    await page.locator(".rd button").click();
    const { now, early, earlyCost, earlyHidden } = await readout(page);
    await page.waitForLoadState("networkidle");
    // The runtime the theme's interaction started is reported apart, as loaded before the click.
    assert.ok(early.some((name) => /^derived-runtime-/.test(name)) && !earlyHidden, `runtime already loaded: ${early.join(", ")}`);
    assert.match(earlyCost, /^Already prefetched before the click: \d+ files?, /);
    // Nothing the theme loaded is counted as fetched for this click; everything the click fetched is listed.
    for (const name of now) assert.ok(!prior.includes(name), `${name} was loaded before the click but listed as fetched for it`);
    const after = (await scriptsNow()).filter((name) => !prior.includes(name));
    assert.deepEqual([...new Set(after)].sort(), [...now].sort(), "the files fetched for the click are exactly the new downloads");
  } finally {
    await page.close();
  }
});

test("resume demo: after a hover, the first click paints within 100 ms on slow 4G + 4x CPU", async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const button = page.locator(".rd button");
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
      }).observe(document.querySelector(".rd")!, { attributes: true, attributeFilter: ["data-clicked"] });
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
    // The hover's intent prefetch (the outermost boundary's chunk: the router Root + the page modules) is reported apart
    // instead of being counted as fetched for the click.
    const { now, early, earlyCost } = await readout(page);
    assert.ok(early.some((name) => /^derived-runtime-/.test(name)) && !now.some((name) => /^derived-runtime-/.test(name)), `prefetched: ${early.join(", ")}; fetched: ${now.join(", ")}`);
    assert.match(earlyCost, new RegExp(`^Already prefetched before the click: ${early.length} files?, `));
  } finally {
    await page.close();
  }
});

test("components stage: static preview first (no state, no script), the live panel mounts on focus with the same markup and box, keyboard opens and closes the Select, no axe violations", async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 }, bypassCSP: true });
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".js")) scripts.push(request.url().slice(request.url().lastIndexOf("/") + 1));
  });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    await page.locator(".lp-stage").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    assert.deepEqual(scripts, [], "no script before the first interaction");
    await page.addScriptTag({ content: `window.__panelSignature = ${panelSignature.toString()};` });
    type Probe = { __panelSignature: typeof panelSignature };
    const snapshot = () =>
      page.evaluate(() => {
        const panel = document.querySelector(".lp-stage > .lp-stage-panel")!;
        const box = panel.getBoundingClientRect();
        return { preview: panel.hasAttribute("data-preview"), signature: (window as unknown as Probe).__panelSignature(panel), box: [box.x, box.y, box.width, box.height] };
      });
    const before = await snapshot();
    assert.ok(before.preview, "the server renders the static preview");
    assert.ok(!(await page.content()).includes("Showcase.tsx#Showcase"), "no resume state for the live panel");
    // Keyboard: focusing a preview control mounts the live panel and moves focus to the same control in it.
    await page.locator(".lp-stage .select__trigger").focus();
    await page.waitForSelector(".lp-stage > .lp-stage-panel:not([data-preview])");
    await page.waitForFunction(() => document.activeElement?.matches(".lp-stage > .lp-stage-panel:not([data-preview]) .select__trigger"));
    await page.waitForLoadState("networkidle");
    const after = await snapshot();
    assert.deepEqual(after.signature, before.signature, "preview = live markup (rerun node apps/docs/scripts/showcase-preview.ts after editing Showcase.tsx)");
    assert.deepEqual(after.box, before.box, "same box: no layout shift on mount");
    const trigger = page.locator(".lp-stage .select__trigger");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "option");
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Frankfurt", "focus on the selected option");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.classList.contains("select__trigger"));
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    // The panel's own state: Save → "Saved", a later change → "Draft".
    await page.locator(".lp-stage button", { hasText: "Save" }).click();
    await page.waitForFunction(() => document.querySelector(".lp-stage .chip")?.textContent === "Saved");
    await page.getByText("Notifications").click();
    await page.waitForFunction(() => document.querySelector(".lp-stage .chip")?.textContent === "Draft");
    await page.addScriptTag({ path: resolve(fileURLToPath(new URL("../../..", import.meta.url)), "node_modules/axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: string) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
      return (await axe.run(".lp-stage")).violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
    });
    assert.deepEqual(violations, []);
  } finally {
    await page.close();
  }
});

test("components stage: a pointer over the preview mounts the live panel; the preview has no axe violations", async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 }, bypassCSP: true });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    await page.locator(".lp-stage").scrollIntoViewIfNeeded();
    await page.addScriptTag({ path: resolve(fileURLToPath(new URL("../../..", import.meta.url)), "node_modules/axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: string) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
      return (await axe.run(".lp-stage")).violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
    });
    assert.deepEqual(violations, [], "preview");
    await page.locator(".lp-stage").hover();
    await page.waitForSelector(".lp-stage > .lp-stage-panel:not([data-preview])");
    assert.equal(await page.locator(".lp-stage [data-preview]").count(), 0);
  } finally {
    await page.close();
  }
});

test("footer: the page's own numbers in the HTML; Measure my visit reports this visit, 0 B of JS loaded with the page", async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
  const before: string[] = [];
  let clicked = false;
  page.on("request", (request) => {
    if (!clicked && request.url().endsWith(".js")) before.push(request.url());
  });
  try {
    await page.goto(origin + "/", { waitUntil: "load" });
    const perf = JSON.parse(readFileSync(resolve(client, "../../content/_home-perf.json"), "utf8")) as { html: { bytes: number }; inlineJs: { bytes: number } };
    const line = (await page.locator(".lp-perf-line").textContent())!;
    assert.match(line, new RegExp(`^This page: ${Math.round(perf.html.bytes / 1000)} KB HTML`));
    assert.ok(line.includes(`${(perf.inlineJs.bytes / 1000).toFixed(1)} KB inline JavaScript, no script files before you interact`), line);
    assert.doesNotMatch(line, /0 B other JavaScript/);
    const button = page.locator(".lp-perf button");
    await button.scrollIntoViewIfNeeded();
    clicked = true;
    assert.deepEqual(before, [], "no script before the click");
    await button.click();
    await page.waitForFunction(() => document.querySelector(".lp-perf-visit")?.textContent);
    assert.match((await page.locator(".lp-perf-visit").textContent())!, /^Your visit: TTFB \d+ ms · LCP \d+ ms · JS loaded with the page: 0 B$/);
  } finally {
    await page.close();
  }
});
