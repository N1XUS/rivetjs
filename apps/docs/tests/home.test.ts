// Homepage contracts on the BUILT site (nx `docs:test` depends on `docs:build`): structure, sourced numbers, links,
// product shot code = the embedded counter page (examples/ui-counter, in an iframe), no JS before input, phone width,
// both themes, interaction after resume, the pane's JS meter = what the frame page fetched.
import { strict as assert } from "node:assert";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { generateContent } from "@rivetjs/docs-kit/tools/content/generate.ts";
import { TEMPLATES } from "../../../libs/create-rivet/index.ts";
import { homeBench } from "../content/_charts.ts";
import { site } from "../site.config.ts";
import { framePath } from "@rivetjs/docs-kit/frame-theme.ts";
import { COUNTER_EXAMPLE } from "../src/components/home/ProductShot.tsx";

const root = fileURLToPath(new URL("..", import.meta.url));
const client = resolve(root, "dist/client");
/** The built home without comments: hole / boundary markers (`<!--[-->`, `<!--b7-->`) split text runs. */
const home = () => readFileSync(resolve(client, "index.html"), "utf8").replace(/<!--[^]*?-->/g, "");
/** The embedded counter: its frame page (built) and its source. */
const COUNTER_FRAME = framePath(COUNTER_EXAMPLE);
const counterPage = () => readFileSync(resolve(client, "." + COUNTER_FRAME, "index.html"), "utf8").replace(/<!--[^]*?-->/g, "");
const COUNTER_SOURCE = resolve(root, "examples", COUNTER_EXAMPLE, "src/routes/index.tsx");
/** The product shot's JS meter text (`#rh-js`, written by docs-kit PARENT_FRAME_JS_METER). */
const meter = (page: Page) => page.locator("#rh-js").textContent();
const section = (html: string, id: string) => {
  const start = html.indexOf(`aria-labelledby="${id}"`);
  assert.ok(start > 0, `section ${id}`);
  return html.slice(start, html.indexOf("</section>", start));
};
const decode = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#10;/g, "\n")
    .replace(/&#123;/g, "{")
    .replace(/&#125;/g, "}")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

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

async function open(options: { width?: number; height?: number; colorScheme?: "light" | "dark"; javaScriptEnabled?: boolean; reducedMotion?: "reduce" | "no-preference" } = {}) {
  const page = await browser.newPage({
    viewport: { width: options.width ?? 1440, height: options.height ?? 900 },
    colorScheme: options.colorScheme ?? "light",
    javaScriptEnabled: options.javaScriptEnabled ?? true,
    reducedMotion: options.reducedMotion ?? "no-preference",
  });
  const scripts: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  return { page, scripts, errors };
}

test("home: hero = one h1, lead, two CTAs to docs pages, the install command with the published version", async () => {
  const html = home();
  assert.equal(html.match(/<h1\b/g)?.length, 1);
  assert.equal(decode(/<h1 id="home-title">([^]*?)<\/h1>/.exec(html)![1]!).replace(/\s+/g, " ").trim(), "The resumable framework for the web");
  assert.match(html, /<span class="rh-grad">resumable<\/span>/, "the gradient marks one word");
  const hero = section(html, "home-title");
  const ctas = [...hero.matchAll(/<a class="button [^"]*" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ctas, ["/start/quick-start/", "/start/what-is-rivet/"]);
  assert.match(hero, /<pre>npm create rivet@latest<\/pre>/);
  assert.ok(hero.includes(`${site.version} · on npm`), "the published version beside the command");
  const quick = readFileSync(resolve(root, "content/start/quick-start.md"), "utf8");
  assert.ok(quick.includes("npm create rivet@latest"), "quick start documents the homepage install command");
  assert.doesNotMatch(html, /not on npm yet|not published|coming soon|npm publish pending/i);
});

test("home: no obsolete hero motion (aurora, rotating words, canvas, animated gradients)", () => {
  const html = home();
  for (const gone of ["hs-aurora", "hs-word", "hs-pause", "<canvas", "hs-workbench", "lp-"]) assert.ok(!html.includes(gone), `no ${gone}`);
  const css = readFileSync(resolve(root, "src/home.css"), "utf8");
  // One animation only: the benchmark bars grow on a view timeline (scroll position), never on a clock.
  assert.deepEqual([...css.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1]), ["rh-grow"], "one keyframe set: the bars");
  const timed = css.replace(/@supports \(animation-timeline: view\(\)\) \{[^]*?\n\}\n/, "").replace(/animation: none;/g, "");
  assert.doesNotMatch(timed, /animation\s*:/, "nothing animates outside the bars' view timeline");
  for (const file of ["src/home-studio.css", "src/components/home/HomeCanvas.tsx", "src/components/home/HomeHeadline.tsx"]) assert.ok(!existsSync(resolve(root, file)), `${file} removed`);
});

test("home: product shot = ui Tabs, three force-mounted panels, one selected; code panes show the embedded counter page's source", () => {
  const html = home();
  const shot = html.slice(html.indexOf('class="rh-shot rh-ui"'), html.indexOf('class="rh-result-note"'));
  const tabs = [...shot.matchAll(/<div [^>]*role="tab"[^>]*>([^<]*)</g)];
  assert.deepEqual(
    tabs.map((m) => m[1]),
    ["Component", "Server HTML", "Browser"],
  );
  assert.equal(tabs.filter((m) => m[0].includes('aria-selected="true"')).length, 1, "one selected tab");
  assert.ok(tabs[0]![0].includes('aria-selected="true"'), "Component first");
  assert.equal(shot.match(/class="tabs__panel rh-pane/g)?.length, 3, "every panel is server HTML");
  assert.ok(!shot.includes("data-slot=\"tabs-indicator\""), "no automatic indicator (its visible trigger would boot the page)");

  const counter = readFileSync(COUNTER_SOURCE, "utf8").trim();
  for (const name of ["_home-component.md", "_home-browser.md"]) {
    const fence = /```tsx[^\n]*\n([^]*?)\n```/.exec(readFileSync(resolve(root, "content", name), "utf8"))?.[1];
    assert.equal(fence, counter, `${name} shows the ui-counter page source verbatim`);
  }
  // The result is that page in a same-origin iframe (title for assistive tech, metered), not a component of the home.
  const frame = /<iframe [^>]*>/.exec(shot)?.[0] ?? "";
  assert.ok(frame.includes(`data-src="${COUNTER_FRAME}"`), "the counter page in an iframe, loaded after the home's load event");
  assert.ok(!/ src=/.test(frame), "no src in the HTML: the frame stays out of the home's first paint");
  assert.match(frame, /title="[^"]{10,}"/, "iframe title");
  assert.match(frame, /data-js-meter="rh-js"/);
  assert.ok(!shot.includes('class="counter"'), "no inline counter on the home");
  assert.ok(site.frameMeters["/"].includes(COUNTER_EXAMPLE), "site.config.ts meters the frame");
  assert.match(html, /id="rh-js"[^>]*>JS loaded: 0 B · 0 files</, "server HTML: nothing loaded yet");
  const panes = [...shot.matchAll(/<pre [^>]*data-pane="(source|dom|server)"[^>]*>([^]*?)<\/pre>/g)];
  assert.ok(decode(panes.find((m) => m[1] === "source")![2]!).includes("const count = signal(0);"));
  assert.match(decode(panes.find((m) => m[1] === "dom")![2]!), /from "@rivetjs\/runtime\/dom"/, "Browser pane = the real compiled DOM module");
});

test("home: the Server HTML pane equals the counter page's server markup (resume markers and ids removed)", () => {
  const built = /<div class="counter"[^]*?<\/div>/.exec(counterPage())![0].replace(/ data-b="\d+"/g, "").replace(/ id="rv\d+"/g, "");
  const fence = /```html[^\n]*\n([^]*?)\n```/.exec(readFileSync(resolve(root, "content/_home-server.md"), "utf8"))![1]!;
  const flat = (text: string) => text.replace(/>\s+</g, "><").trim();
  assert.equal(flat(fence), flat(built));
});

test("home: benchmark = one claim, one bar comparison, three chips, all from content/_charts.ts homeBench", () => {
  const html = home();
  const numbers = section(html, "home-numbers-title");
  const title = decode(/<h2 id="home-numbers-title">([^]*?)<\/h2>/.exec(numbers)![1]!).replace(/\s+/g, " ").trim();
  assert.equal(title, `${homeBench.big} less server CPU than ${homeBench.peer}`);
  const bars = [...numbers.matchAll(/<li( data-rivet="")? style="--v:([\d.]+)"><span class="rh-bar-label">([^<]+)<\/span>[^]*?<data value="[^"]+">([^<]+)<\/data>/g)];
  assert.deepEqual(
    bars.map((m) => [m[3], m[4]]),
    homeBench.bars.map((bar) => [bar.label, bar.text]),
    "every bar: label + value label",
  );
  assert.deepEqual(bars.filter((m) => m[1]).map((m) => m[3]), ["Rivet"], "only Rivet's bar is marked (logo gradient)");
  assert.equal(bars.at(-1)![2], "1.0000", "the slowest lane is the full bar");
  const chips = [...numbers.matchAll(/<li><a href="([^"]+)"><data value="[^"]+">([^<]+)<\/data><span>([^<]+)<\/span><\/a><\/li>/g)];
  assert.deepEqual(
    chips.map((m) => [m[1], m[2], m[3]]),
    homeBench.chips.map((chip) => [chip.href, chip.big, chip.text]),
  );
  const benchmarks = readFileSync(resolve(client, "about/benchmarks/index.html"), "utf8");
  for (const chip of homeBench.chips.filter((c) => c.href.startsWith("/about/benchmarks/#")))
    assert.ok(benchmarks.includes(`id="${chip.href.split("#")[1]}"`), `${chip.href}: the chart exists`);
  assert.match(numbers, /href="\/about\/benchmarks\/"/, "See all benchmarks");
  assert.ok(numbers.includes(`href="${homeBench.methodology}"`), "methodology link");
  assert.doesNotMatch(numbers, /rh-caveat|rh-sources|rh-stats/, "caveats and losses live on /about/benchmarks/");
  // Every typed ratio on the page comes from homeBench (no hand-written claims).
  const text = decode(html.slice(html.indexOf("<main"), html.indexOf("</main>")).replace(/<pre[^]*?<\/pre>/g, "").replace(/<[^>]+>/g, " "));
  const allowed = new Set([homeBench.big, ...homeBench.chips.map((chip) => chip.big)]);
  for (const ratio of text.match(/\d+(?:\.\d+)?×/g) ?? []) assert.ok(allowed.has(ratio), `${ratio} comes from homeBench`);
});

test("home: six feature cards and three steps link to existing pages; icons are lucide through kit Icon", async () => {
  const html = home();
  const { pages } = await generateContent(root, { dryRun: true });
  const hrefs = new Set(pages.map((page) => page.href));
  const features = section(html, "home-features-title");
  const links = [...features.matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(links.length, 6);
  for (const href of links) assert.ok(hrefs.has(href), `feature links a docs page: ${href}`);
  assert.equal(features.match(/<span class="rh-icon"><svg [^>]*aria-hidden="true"/g)?.length, 6, "one decorative icon per card");
  for (const name of ["Compiled JSX", "Resumable pages", "Fine-grained signals", "File routing", "Compile-time i18n", "Framework bridges"]) {
    assert.ok(features.includes(`<h3>${name}</h3>`), name);
  }
  const how = section(html, "home-how-title");
  assert.equal(how.match(/<li>/g)?.length, 3);
  assert.ok(hrefs.has("/learn/resuming/") && how.includes('href="/learn/resuming/"'));
  for (const file of ["src/routes/index.tsx", "src/components/home/ProductShot.tsx", COUNTER_SOURCE]) {
    const source = readFileSync(resolve(root, file), "utf8");
    assert.doesNotMatch(source, /<svg|<path|[\u2190-\u21ff\u2700-\u27bf\u2600-\u26ff]/, `${file}: no hand-drawn SVG or glyph icons`);
  }
});

test("home: the component libraries link to the UI and CDK docs sites", () => {
  const family = section(home(), "home-family-title");
  const links = [...family.matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, [site.sites.ui + "/", site.sites.cdk + "/"]);
});

test("home: starters = every templates/ starter with its create-rivet id; final CTA", async () => {
  const html = home();
  const starters = section(html, "home-starters-title");
  const ids = [...starters.matchAll(/<code>--template ([a-z]+)<\/code>/g)].map((m) => m[1]);
  assert.deepEqual([...ids].sort(), TEMPLATES.map((t) => t.id).sort());
  const dirs = readdirSync(resolve(root, "../../templates")).filter((d) => d.startsWith("starter-"));
  assert.deepEqual(TEMPLATES.map((t) => t.dir).sort(), dirs.sort(), "one card per templates/ starter");
  assert.match(starters, /class="card [^"]*rh-starter/, "ui Card");
  assert.match(starters, /href="\/start\/quick-start\/#starters"/);
  assert.match(readFileSync(resolve(client, "start/quick-start/index.html"), "utf8"), /id="starters"/);
  const final = section(html, "home-final-title");
  assert.match(final, /href="\/start\/quick-start\/"/);
  assert.ok(final.includes(`href="${site.repo}"`));
});

test("home: no JS before input (desktop + phone, both themes), CLS 0, no horizontal scroll at 375 px", async () => {
  for (const [width, height] of [
    [1440, 900],
    [375, 812],
  ] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      const { page, scripts, errors } = await open({ width, height, colorScheme });
      try {
        assert.deepEqual(scripts, [], `${width}/${colorScheme}: no script fetched before input (home + counter frame)`);
        assert.equal(await meter(page), "JS loaded: 0 B · 0 files", "the frame reported no JS before input");
        assert.equal(await page.locator('link[rel="modulepreload"]').count(), 0, "no modulepreload before input");
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), colorScheme);
        assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${width}: no horizontal scroll`);
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(100);
        // Lighthouse shows CLS 0 (0.00014 measured): what is left is the docs-wide Manrope swap over its metric-matched
        // fallback (docs-kit fonts.ts); the hero is left-aligned with fixed headline lines so nothing re-centres or re-wraps.
        assert.ok((await page.evaluate(() => (window as unknown as { __cls: number }).__cls)) < 0.001, "CLS below 0.001");
        // Only the bars' scroll-driven animation exists; nothing runs on the document (time) timeline.
        assert.equal(await page.evaluate(() => document.getAnimations().filter((a) => a.timeline === document.timeline).length), 0, "nothing animates on a clock");
        await page.locator(".rh-bars").evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(100);
        const scale = await page.locator(".rh-bars > li:last-child .rh-bar").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
        assert.ok(scale > 0.999, `${width}/${colorScheme}: bars full length once in view (${scale})`);
        assert.deepEqual(errors, []);
      } finally {
        await page.close();
      }
    }
  }
});

test("home: both themes are designed: text and surfaces follow the theme, headline contrast holds", async () => {
  const colors: Record<string, { bg: string; fg: string; shot: string }> = {};
  for (const colorScheme of ["light", "dark"] as const) {
    const { page } = await open({ colorScheme });
    try {
      colors[colorScheme] = await page.evaluate(() => ({
        bg: getComputedStyle(document.body).backgroundColor,
        fg: getComputedStyle(document.querySelector("h1")!).color,
        shot: getComputedStyle(document.querySelector(".rh-result")!).backgroundColor,
      }));
    } finally {
      await page.close();
    }
  }
  assert.notEqual(colors.light!.bg, colors.dark!.bg);
  assert.notEqual(colors.light!.fg, colors.dark!.fg);
  assert.notEqual(colors.light!.shot, colors.dark!.shot);
});

test("home: tabs and counter resume on input; every panel is readable without JS", async () => {
  const { page, errors } = await open();
  try {
    await page.getByRole("tab", { name: "Server HTML" }).click();
    await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === "Server HTML");
    assert.match((await page.locator('.rh-pane:not([inert]) pre').first().textContent()) ?? "", /<output aria-live="polite">0<\/output>/);
    await page.getByRole("tab", { name: "Browser" }).click();
    await page.waitForFunction(() => document.querySelector('.rh-pane:not([inert]) pre[data-pane="dom"]')?.getBoundingClientRect().height! > 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
  const noJs = await open({ javaScriptEnabled: false });
  try {
    const visible = await noJs.page.$$eval(".rh-pane", (panes) => panes.filter((pane) => (pane as HTMLElement).offsetHeight > 0).length);
    assert.equal(visible, 1, "the selected panel shows without JS");
    assert.equal(await noJs.page.locator(".rh-pane pre").count(), 5, "all code is in the HTML (component, server HTML, compiled source / dom / server)");
  } finally {
    await noJs.page.close();
  }
});

test("home: the counter frame resumes on its first press (cold, mouse); the meter shows exactly the JS the frame fetched", async () => {
  for (const width of [1440, 375]) {
    const { page, errors } = await open({ width, height: width > 400 ? 900 : 812 });
    try {
      const frame = page.frame({ url: (url) => url.pathname === COUNTER_FRAME })!;
      assert.ok(frame, "counter frame loaded");
      const frameElement = await page.locator("iframe.rh-frame").elementHandle();
      const before = await frame.evaluate(() => performance.getEntriesByType("resource").filter((e) => /\.m?js$/.test(new URL(e.name).pathname)).length);
      assert.equal(before, 0, "the counter page fetched no JS before input");
      assert.equal(await meter(page), "JS loaded: 0 B · 0 files");
      const fetched: string[] = [];
      page.on("request", (request) => {
        if (request.frame() === frame && /\.m?js$/.test(new URL(request.url()).pathname)) fetched.push(request.url());
      });
      const counter = page.frameLocator("iframe.rh-frame");
      await page.locator("iframe.rh-frame").scrollIntoViewIfNeeded();
      await counter.getByRole("button", { name: "Increment" }).click();
      await frame.waitForFunction(() => document.querySelector(".counter output")?.textContent === "1");
      assert.equal(await counter.getByRole("button", { name: "Reset" }).isDisabled(), false);
      await counter.getByRole("button", { name: "Reset" }).click();
      await frame.waitForFunction(() => document.querySelector(".counter output")?.textContent === "0");
      await page.waitForLoadState("networkidle");
      // The home resumed meanwhile (the pointer crossed it): its adopt run kept the iframe and its page.
      assert.equal(await page.locator("iframe.rh-frame").elementHandle().then((el) => el?.evaluate((node, old) => node === old, frameElement)), true);
      assert.equal(await frame.evaluate(() => document.querySelector(".counter output")?.textContent), "0");
      assert.equal(page.frames().filter((f) => new URL(f.url()).pathname === COUNTER_FRAME).length, 1);
      // The meter = the frame's own resource timing, posted to the home: files and transferred bytes.
      const entries = await frame.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((e) => /\.m?js$/.test(new URL(e.name).pathname))
          .map((e) => ({ name: e.name, transfer: (e as PerformanceResourceTiming).transferSize, encoded: (e as PerformanceResourceTiming).encodedBodySize })),
      );
      assert.ok(entries.length > 0, "the first press fetched the counter's code");
      // Every JS file the frame fetched over the network shows up as a request of that frame (a file the parent page had
      // already loaded can come from the memory cache without one: counted as cached).
      const network = entries.filter((e) => e.transfer > 0 && e.transfer >= e.encoded);
      for (const e of network) assert.ok(fetched.includes(e.name), `${e.name}: a request of the frame`);
      const bytes = entries.reduce((sum, e) => sum + (network.includes(e) ? e.transfer : e.encoded), 0);
      const n = entries.length;
      const c = n - network.length;
      const cached = c === n ? " · from cache" : c ? ` · ${c} cached` : "";
      assert.equal(await meter(page), `JS loaded: ${(bytes / 1024).toFixed(1)} KB · ${n} ${n === 1 ? "file" : "files"}${cached}`);
      // The meter's new text moved nothing (its lines are reserved on a phone): layout shifts stay ~0, input or not.
      const shifts = await page.evaluate(() =>
        (performance.getEntriesByType("layout-shift") as unknown as { value: number }[]).reduce((sum, e) => sum + e.value, 0),
      );
      assert.ok(shifts < 0.001, `${width}: layout shift after the press ${shifts}`);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
});

test("home: keyboard reaches the counter frame: Tab from the address link into the page, Enter presses Increment", async () => {
  const { page, errors } = await open();
  try {
    await page.locator(".rh-url").focus();
    await page.keyboard.press("Tab");
    const frame = page.frame({ url: (url) => url.pathname === COUNTER_FRAME })!;
    await frame.waitForFunction(() => document.activeElement?.textContent === "Increment");
    await page.keyboard.press("Enter");
    await frame.waitForFunction(() => document.querySelector(".counter output")?.textContent === "1");
    await page.waitForFunction(() => /^JS loaded: [\d.]+ KB · \d+ files?( · .+)?$/.test(document.querySelector("#rh-js")?.textContent ?? ""));
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test("home: the counter frame follows the home's theme and paints the shot's background", async () => {
  for (const colorScheme of ["light", "dark"] as const) {
    const { page } = await open({ colorScheme });
    try {
      const frame = page.frame({ url: (url) => url.pathname === COUNTER_FRAME })!;
      await frame.waitForFunction((theme) => document.documentElement.dataset.theme === theme, colorScheme);
      const pane = await page.locator(".rh-result").evaluate((el) => getComputedStyle(el).backgroundColor);
      const body = await frame.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert.equal(body, pane, `${colorScheme}: frame background = the pane's`);
    } finally {
      await page.close();
    }
  }
});

test("home: reduced motion: the benchmark bars are static, full length, no animation", async () => {
  const { page } = await open({ reducedMotion: "reduce" });
  try {
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    const scale = await page.locator(".rh-bars > li:last-child .rh-bar").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    assert.equal(scale, 1);
  } finally {
    await page.close();
  }
});
