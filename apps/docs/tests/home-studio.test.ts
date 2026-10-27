// Production regressions for the selected Runtime Studio homepage and its requested motion.
import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser } from "playwright";
import { compile } from "@rivetjs/compiler";
import { DERIVED_BUILD, rewrite, withPage } from "../../../libs/runtime/tests/resume/harness.ts";

const client = resolve(fileURLToPath(new URL("..", import.meta.url)), "dist/client");
let server: Server;
let origin: string;
let browser: Browser;
beforeAll(async () => {
  server = createServer((req, res) => {
    let path = resolve(client, "." + decodeURIComponent(new URL(req.url!, "http://x").pathname));
    if (existsSync(path) && !path.includes(".", path.lastIndexOf("/"))) path = resolve(path, "index.html");
    if (!existsSync(path)) return void res.writeHead(404).end();
    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".woff2": "font/woff2",
    };
    res.writeHead(200, { "content-type": types[path.slice(path.lastIndexOf("."))] ?? "application/octet-stream" }).end(readFileSync(path));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  await new Promise((done) => server?.close(done));
});
async function home(reducedMotion: "reduce" | "no-preference" = "no-preference", width = 1440, injectAxe = false) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion, bypassCSP: injectAxe });
  page.setDefaultTimeout(8000);
  await page.goto(origin + "/");
  return page;
}

/** In the page: the word the CSS rotation shows now, fully (STATIC-ZERO-3: the three words are stacked server markup;
 * every letter of the shown one is opaque), or null mid-transition. */
const shownWord = () => {
  for (const word of document.querySelectorAll<HTMLElement>(".hs-word")) {
    const letters = [...word.children];
    if (getComputedStyle(word).visibility !== "hidden" && letters.every((letter) => Number(getComputedStyle(letter).opacity) > 0.9)) return word.textContent;
  }
  return null;
};
const shownIs = (text: string) => {
  for (const word of document.querySelectorAll<HTMLElement>(".hs-word")) {
    const letters = [...word.children];
    if (getComputedStyle(word).visibility !== "hidden" && letters.every((letter) => Number(getComputedStyle(letter).opacity) > 0.9)) return word.textContent === text;
  }
  return false;
};

test("studio hero: selected headline, docs CTA and mobile containment", async () => {
  const page = await home("no-preference", 375);
  try {
    assert.equal(await page.getByRole("heading", { level: 1 }).getAttribute("aria-label"), "Make the web feel alive, fast and fluid.");
    assert.match((await page.evaluate(shownWord)) ?? "", /^(alive|fast|fluid)\.$/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
    assert.equal(await page.getByRole("link", { name: "Start building", exact: true }).getAttribute("href"), "/start/quick-start/");
    assert.match(await page.locator(".hs-command pre").innerText(), /npm create rivet@latest/);
  } finally {
    await page.close();
  }
});

test("studio counter: cold input, rapid reversals, decimal boundary and keyboard tabs", async () => {
  const page = await home();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const value = page.locator("#home-counter-value");
    assert.equal(await value.textContent(), "07");
    const inc = page.getByRole("button", { name: "Increment counter", exact: true });
    const dec = page.getByRole("button", { name: "Decrement counter", exact: true });
    for (let i = 0; i < 4; i++) await inc.click();
    for (let i = 0; i < 2; i++) await dec.click();
    await page.waitForFunction(() => document.querySelector("#home-counter-value")?.textContent === "09");
    await inc.click();
    await page.waitForFunction(() => document.querySelector("#home-counter-value")?.textContent === "10");
    await page.waitForFunction(() => document.querySelector(".hs-counter-digits")?.getAttribute("data-value") === "10");
    await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLElement>(".hs-digit-window")].every((cell, index) => {
        const track = cell.firstElementChild!.getBoundingClientRect();
        const box = cell.getBoundingClientRect();
        return Math.abs(track.top - box.top + (index === 0 ? box.height : 0)) < 1;
      }),
    );
    await page.getByRole("tab", { name: "Component", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement?.id === "home-tab-server");
    assert.equal(await page.getByRole("tab", { name: "Server HTML", exact: true }).getAttribute("aria-selected"), "true");
    assert.match(await page.locator("#home-code-server").innerText(), /button/);
    await page.keyboard.press("Home");
    await page.waitForFunction(() => document.activeElement?.id === "home-tab-component");
    await dec.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#home-counter-value")?.textContent === "09");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test("studio aurora: CSS blobs really drift, the native checkbox pauses and resumes them", async () => {
  const page = await home();
  try {
    const blobs = () => page.evaluate(() => [...document.querySelectorAll(".hs-aurora .hs-blob")].map((blob) => getComputedStyle(blob).translate + " " + getComputedStyle(blob).scale));
    const running = () => page.evaluate(() => document.querySelector(".hs-aurora .hs-blob")!.getAnimations().map((a) => a.playState));
    assert.equal((await blobs()).length, 4);
    assert.deepEqual(await running(), ["running", "running"]);
    const before = await blobs();
    await page.waitForTimeout(400);
    assert.notDeepEqual(await blobs(), before, "the blobs move");
    // The mouse path: a click on the visible label toggles its visually hidden checkbox.
    const pause = page.getByRole("checkbox", { name: "Pause background animation", exact: true });
    await page.locator(".hs-ambient-control").click();
    assert.ok(await pause.isChecked());
    assert.deepEqual(await running(), ["paused", "paused"]);
    // A pending pause settles on the next frame (its current time is held from then on).
    await page.evaluate(() => Promise.all(document.querySelector(".hs-aurora .hs-blob")!.getAnimations().map((a) => a.ready)));
    await page.waitForTimeout(50);
    const paused = await blobs();
    await page.waitForTimeout(300);
    assert.deepEqual(await blobs(), paused);
    await page.locator(".hs-ambient-control").click();
    assert.ok(!(await pause.isChecked()));
    assert.deepEqual(await running(), ["running", "running"]);
  } finally {
    await page.close();
  }
});

test("studio schema: keyboard stages and replay explain HTML, adoption and updates", async () => {
  const page = await home();
  try {
    const stages = page.getByRole("tablist", { name: "How Rivet works" });
    await stages.getByRole("tab", { name: /Start with the page/ }).click();
    await page.waitForFunction(() => document.querySelector(".hs-architecture")?.getAttribute("data-stage") === "1");
    assert.match(await page.locator("#home-stage-scene").innerText(), /HTML/);
    await stages.getByRole("tab", { name: /Start with the page/ }).focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.querySelector(".hs-architecture")?.getAttribute("data-stage") === "2");
    assert.match(await page.locator("#home-stage-scene").innerText(), /adopt|interaction/i);
    await page.getByRole("button", { name: "Replay resumability diagram", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".hs-resume-diagram")?.getAttribute("data-step") === "4", undefined, { timeout: 12000 });
    assert.match(await page.locator(".hs-resume-diagram").innerText(), /HTML|signal|DOM/);
  } finally {
    await page.close();
  }
});

test("studio reduced motion and no-JS: still aurora and readable server content", async () => {
  const page = await home("reduce");
  try {
    assert.equal(await page.evaluate(() => document.querySelector(".hs-aurora .hs-blob")!.getAnimations().length), 0, "still aurora");
    await page.getByRole("button", { name: "Increment counter", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#home-counter-value")?.textContent === "08");
    await page.waitForFunction(() => document.getAnimations().filter((a) => a.playState === "running").length === 0);
  } finally {
    await page.close();
  }
  const plain = await browser.newPage({ viewport: { width: 1440, height: 1000 }, javaScriptEnabled: false });
  try {
    await plain.goto(origin + "/");
    assert.equal(await plain.locator("#home-counter-value").textContent(), "07");
    assert.match(await plain.locator("#home-code-component").innerText(), /signal/);
    assert.ok(await plain.getByRole("link", { name: /Learn the framework/ }).isVisible());
    await plain.evaluate(() => document.fonts.ready);
    mkdirSync(resolve(".artifacts/home-studio"), { recursive: true });
    await plain.locator(".hs-hero-copy").screenshot({ path: resolve(".artifacts/home-studio/hero-no-js.png") });
    await plain.emulateMedia({ media: "print" });
    assert.ok(await plain.locator("#home-stage-scene").isVisible());
  } finally {
    await plain.close();
  }
});

test("studio headline: words stagger without moving the heading box and pause at rest", async () => {
  const page = await home();
  try {
    const headline = page.locator(".hs-headline h1");
    const box = () => headline.evaluate((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]);
    const initial = await box();
    await page.waitForFunction(shownIs, "fast.", { timeout: 6000 });
    assert.deepEqual(await box(), initial);
    await page.locator(".hs-word-pause").click();
    assert.ok(await page.getByRole("checkbox", { name: "Pause headline animation", exact: true }).isChecked());
    await page.waitForTimeout(600);
    const paused = await page.evaluate(shownWord);
    await page.waitForTimeout(3300);
    assert.equal(await page.evaluate(shownWord), paused);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(shownIs, "alive.");
    assert.deepEqual(await box(), initial);
  } finally {
    await page.close();
  }
});

test("studio headline: replacement words enter from hidden with staggered blur and no flash", async () => {
  const page = await home();
  try {
    const transitions = await page.evaluate(
      () =>
        new Promise<{ word: string; firstHidden: boolean; blurred: boolean; staggered: boolean; settled: boolean }[]>((resolve) => {
          type Track = { word: string; firstHidden: boolean; blurred: boolean; staggered: boolean; settled: boolean; seen: boolean };
          const words = [...document.querySelectorAll<HTMLElement>(".hs-word")];
          // Word 0 is on screen at load; the samples follow fast. → fluid. → alive. (its second entry).
          const order = [1, 2, 0];
          const tracks: Track[] = order.map((i) => ({ word: words[i]!.textContent!, firstHidden: false, blurred: false, staggered: false, settled: false, seen: false }));
          let step = 0;
          let leftZero = false;
          const started = performance.now();
          function sample(now: number) {
            const index = order[step]!;
            const styles = [...words[index]!.children].map((letter) => getComputedStyle(letter));
            const track = tracks[step]!;
            const hidden = styles.every((style) => Number(style.opacity) < 0.1);
            if (index === 0 && !leftZero) leftZero = hidden;
            const watching = index !== 0 || leftZero;
            if (watching) {
              if (!track.seen && hidden) track.firstHidden = true;
              if (!hidden) track.seen = true;
              track.blurred ||= styles.some((style) => Number(style.opacity) > 0.1 && Number(style.opacity) < 0.9 && parseFloat(style.filter.slice(5)) > 2);
              track.staggered ||= Number(styles[0]!.opacity) > 0.3 && Number(styles.at(-1)!.opacity) < 0.1;
              track.settled ||= styles.every(
                (style) =>
                  Number(style.opacity) === 1 && new DOMMatrixReadOnly(style.transform).m42 === 0 && (style.filter === "none" || style.filter === "blur(0px)"),
              );
              if (track.settled) step++;
            }
            if (step === 3 || now - started > 12000) resolve(tracks.map(({ seen: _, ...rest }) => rest));
            else requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        }),
    );
    assert.deepEqual(
      transitions.map(({ word }) => word),
      ["fast.", "fluid.", "alive."],
    );
    for (const transition of transitions) {
      assert.ok(transition.firstHidden, `${transition.word} must never paint fully visible before entering`);
      assert.ok(transition.blurred, `${transition.word} visibly blurs during entry`);
      assert.ok(transition.staggered, `${transition.word} enters letter by letter`);
      assert.ok(transition.settled, `${transition.word} settles sharp and aligned`);
    }
  } finally {
    await page.close();
  }
});

test("studio headline: reduced motion interrupts exit and entry without leaving hidden or blurry text", async () => {
  const page = await home();
  try {
    const sharp = () =>
      page.evaluate(() => {
        const [first, ...rest] = [...document.querySelectorAll<HTMLElement>(".hs-word")];
        return (
          first!.textContent === "alive." &&
          getComputedStyle(first!).visibility === "visible" &&
          rest.every((word) => getComputedStyle(word).visibility === "hidden") &&
          [...first!.children].every((letter) => {
            const style = getComputedStyle(letter);
            return style.opacity === "1" && (style.filter === "none" || style.filter === "blur(0px)") && new DOMMatrixReadOnly(style.transform).m42 === 0;
          })
        );
      });
    for (const index of [0, 1]) {
      // Mid-transition: a letter of word `index` half faded and blurred.
      await page.waitForFunction(
        (i) => {
          const style = getComputedStyle(document.querySelectorAll(".hs-word")[i]!.firstElementChild!);
          return Number(style.opacity) > 0.1 && Number(style.opacity) < 0.9 && style.filter !== "none";
        },
        index,
        { timeout: 10000, polling: "raf" },
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(100);
      assert.ok(await sharp(), "preference changes reveal a complete, sharp static word");
      await page.waitForTimeout(600);
      assert.ok(await sharp(), "a cancelled transition cannot overwrite the static word");
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
    await page.waitForFunction(shownIs, "fast.", { timeout: 6000 });
  } finally {
    await page.close();
  }
});

test("studio headline: each letter shows its own slice of one word gradient, so the colours run on across letters", async () => {
  const page = await home("reduce");
  try {
    await page.evaluate(() => document.fonts.ready);
    const sliced = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".hs-word")].every((word) => {
          const letters = [...word.querySelectorAll<HTMLElement>(".hs-word-letter")];
          const n = letters.length;
          return letters.every((letter, j) => {
            const style = getComputedStyle(letter);
            const width = letter.getBoundingClientRect().width;
            // Background n letters wide, shifted by j letters: letter j paints the gradient's j/n … (j+1)/n.
            const size = parseFloat(style.backgroundSize) / 100;
            const position = parseFloat(style.backgroundPositionX) / 100;
            return style.backgroundClip === "text" && Math.abs(size - n) < 1e-6 && Math.abs(position * (width - size * width) + j * width) < 0.5;
          });
        }),
      );
    assert.ok(await sliced(), "one gradient per word, sliced per letter");
    await page.setViewportSize({ width: 375, height: 900 });
    assert.ok(await sliced(), "the slices hold at the phone type size");
  } finally {
    await page.close();
  }
});

test("studio counter: repeated keyboard input clamps at both limits without stale digits", async () => {
  const page = await home("reduce");
  try {
    const inc = page.getByRole("button", { name: "Increment counter", exact: true });
    await inc.focus();
    for (let n = 0; n < 100; n++) await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#home-counter-value")?.textContent === "99");
    assert.ok(await inc.isDisabled());
    const dec = page.getByRole("button", { name: "Decrement counter", exact: true });
    await dec.focus();
    for (let n = 0; n < 105; n++) await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#home-counter-value")?.textContent === "00");
    assert.ok(await dec.isDisabled());
    assert.equal(await page.locator(".hs-counter-digits").getAttribute("data-value"), "00");
  } finally {
    await page.close();
  }
});

test("studio code sample: copied source compiles and reproduces the preview's formatting, controls and limits", async () => {
  const page = await home("reduce");
  let source: string;
  try {
    source = (await page.locator(".hs-code-line > span:last-child").allTextContents()).join("\n");
  } finally {
    await page.close();
  }
  const result = compile(source, { filename: "copied-counter.tsx", target: "dom" });
  assert.deepEqual(result.diagnostics, []);
  await withPage(
    {
      ...DERIVED_BUILD,
      "/": '<!doctype html><main id="sample"></main><script type="module">import { mount } from "/dom.ts"; import Counter from "/sample.js"; mount(() => Counter(), document.querySelector("main"));</script>',
      "/sample.js": rewrite(result.code),
    },
    async (copied) => {
      copied.setDefaultTimeout(5000);
      await copied.goto("http://rivet.test/");
      await copied.waitForSelector("#sample > *");
      assert.equal(await copied.locator("output").count(), 1, "the copied component exposes the same formatted value");
      assert.equal(await copied.locator("output").textContent(), "07");
      const inc = copied.getByRole("button", { name: "Increment counter", exact: true });
      const dec = copied.getByRole("button", { name: "Decrement counter", exact: true });
      for (let n = 0; n < 3; n++) await inc.click();
      await copied.waitForFunction(() => document.querySelector("output")?.textContent === "10");
      await copied.evaluate(() => {
        for (let n = 0; n < 100; n++) document.querySelectorAll<HTMLButtonElement>("button")[1]!.click();
      });
      await copied.waitForFunction(() => document.querySelector("output")?.textContent === "99");
      assert.ok(await inc.isDisabled());
      await copied.evaluate(() => {
        for (let n = 0; n < 110; n++) document.querySelectorAll<HTMLButtonElement>("button")[0]!.click();
      });
      await copied.waitForFunction(() => document.querySelector("output")?.textContent === "00");
      assert.ok(await dec.isDisabled());
    },
  );
});

test("studio schema: explanatory text keeps AA contrast in the early manual steps", async () => {
  const page = await home("no-preference", 1440, true);
  try {
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
    for (const step of ["render", "send", "wait"]) {
      await page.getByRole("button", { name: `Show ${step} step`, exact: true }).click();
      await page.waitForTimeout(600); // Allow the staggered decorative transition to settle.
      const minimum = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        const rgb = (color: string) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const background = rgb(getComputedStyle(document.querySelector(".hs-home")!).backgroundColor);
        const luminance = (color: number[]) =>
          color
            .map((n) => n / 255)
            .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
            .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i]!, 0);
        return Math.min(
          ...[...document.querySelectorAll<HTMLElement>(".hs-loop-node > span:last-of-type")].map((label) => {
            let opacity = 1;
            for (let node: HTMLElement | null = label; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
            const foreground = rgb(getComputedStyle(label).color).map((n, i) => n * opacity + background[i]! * (1 - opacity));
            return (luminance(foreground) + 0.05) / (luminance(background) + 0.05);
          }),
        );
      });
      assert.ok(minimum >= 4.5, `${step}: effective label contrast ${minimum.toFixed(2)}:1 includes ancestor opacity`);
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (root: string) => Promise<{ violations: { id: string }[] }> } }).axe;
        return (await axe.run(".hs-interaction-loop")).violations.map((v) => v.id);
      });
      assert.deepEqual(violations, [], `${step}: labels remain readable before the interaction`);
    }
  } finally {
    await page.close();
  }
});

test("studio visual evidence: desktop and phone, real layout in both themes, no axe violations", async () => {
  const dir = resolve(".artifacts/home-studio");
  mkdirSync(dir, { recursive: true });
  for (const theme of ["dark", "light"] as const) {
    // Axe is injected only in this visual/a11y context. Interaction tests retain the production CSP.
    const page = await home("reduce", 1440, true);
    try {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      await page.evaluate(() => document.fonts.ready);
      await page.locator("#home-docs").scrollIntoViewIfNeeded();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: resolve(dir, `desktop-${theme}.png`), fullPage: true });
      await page.locator(".hs-architecture").screenshot({ path: resolve(dir, `schema-${theme}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1440);
      await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (root: string) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        return (await axe.run(".hs-home")).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
      });
      assert.deepEqual(violations, [], theme);
      await page.setViewportSize({ width: 375, height: 900 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: resolve(dir, `phone-${theme}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
    } finally {
      await page.close();
    }
  }
});
