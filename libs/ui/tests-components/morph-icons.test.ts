// Morph icons (TWEAKS.md TW-149) — resumed story app (`/morph-icons`): the default chevron of Select / ComboBox / Autocomplete /
// CellSelect / NativeSelect and the Navbar burger are CSS bars (no svg) whose shape follows one registered number `--morph-p`
// transitioned on the bars: lucide ChevronDown / Menu geometry at rest, nothing animates at load (no first-render playback),
// open → close → open mid-flight reverses without a jump, reduced motion (data attribute or the media query) swaps
// instantly, a custom indicator child keeps the rotate, the ink (stroke weight) is lucide's within ±10 % at 1× and 2×.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import sharp from "sharp";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>, reducedMotion: "reduce" | "no-preference" = "no-preference", deviceScaleFactor = 1): Promise<void> {
  const context = await s.browser.newContext({ viewport: { width: 1100, height: 800 }, reducedMotion, deviceScaleFactor });
  const page = await context.newPage();
  try {
    await page.goto(s.origin + "/morph-icons");
    await page.waitForLoadState("networkidle");
    await body(page);
  } finally {
    await context.close();
  }
}

const CHEVRONS = {
  select: "[data-testid=mi-sel] [data-slot=select-default-indicator]",
  comboBox: "[data-testid=mi-cb] [data-slot=combo-box-trigger-default-icon]",
  autocomplete: "[data-testid=mi-ac] [data-slot=autocomplete-default-indicator]",
  cellSelect: "[data-testid=mi-cs] [data-slot=cell-select-default-indicator]",
  nativeSelect: "[data-testid=mi-ns] [data-slot=native-select-default-indicator]",
};
const BURGER = "#mi-nav-toggle [data-slot=navbar-menu-toggle-icon]";

/** Computed bar geometry: rotation (deg), width (px, drawn 8× and scaled by .125: the layout width / 8), translate x / y (px) of
 * `::before` / `::after`, + `--morph-p`. */
const bars = (page: Page, sel: string) =>
  page.$eval(sel, (el) => {
    const read = (pseudo: string) => {
      const cs = getComputedStyle(el, pseudo);
      const m = new DOMMatrix(cs.transform);
      return {
        content: cs.content,
        rot: Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI),
        width: parseFloat(cs.width) / 8,
        x: m.e,
        y: m.f,
        p: +cs.getPropertyValue("--morph-p"),
      };
    };
    const box = el.getBoundingClientRect();
    return { tag: el.tagName, svg: el.querySelectorAll("svg").length, size: [box.width, box.height], before: read("::before"), after: read("::after") };
  });

/** Running CSS transitions on the element's bars. */
const transitions = (page: Page, sel: string) =>
  page.$eval(sel, (el) => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.target === el).length);

/** `--morph-p` of `::before` sampled every frame for `ms`. */
async function sample(page: Page, sel: string, ms: number): Promise<number[]> {
  return page.$eval(
    sel,
    (el, ms) =>
      new Promise<number[]>((done) => {
        const out: number[] = [];
        const t0 = performance.now();
        const frame = () => {
          out.push(+getComputedStyle(el, "::before").getPropertyValue("--morph-p"));
          if (performance.now() - t0 < ms) requestAnimationFrame(frame);
          else done(out);
        };
        requestAnimationFrame(frame);
      }),
    ms,
  );
}

const maxStep = (values: number[]) => values.slice(1).reduce((m, v, i) => Math.max(m, Math.abs(v - values[i]!)), 0);

test("morph chevron: CSS bars with lucide ChevronDown geometry at rest; nothing animates at load", () =>
  onPage(async (page) => {
    for (const [name, sel] of Object.entries(CHEVRONS)) {
      const b = await bars(page, sel);
      assert.equal(b.tag, "SPAN", name);
      assert.equal(b.svg, 0, `${name}: no svg`);
      assert.deepEqual(b.size, [16, 16], `${name}: 16 px box`);
      assert.equal(b.before.content, '""', name);
      assert.equal(b.before.p, 0, name);
      // lucide m6 9 6 6 6-6 at 16 px: arms 4 × 4 px at ±45°, stroke 16 / 12 (round caps add one stroke to the length).
      assert.equal(b.before.rot, 45, name);
      assert.equal(b.after.rot, -45, name);
      assert.ok(Math.abs(b.before.width - (4 * Math.SQRT2 + 16 / 12)) < 0.05, `${name}: arm length ${b.before.width}`);
      assert.equal(await transitions(page, sel), 0, `${name}: no first-render playback`);
    }
  }));

test("morph chevron: Select open → close → open mid-flight reverses without a jump; settles as ⌃", () =>
  onPage(async (page) => {
    const seen = watch(page);
    const sel = CHEVRONS.select;
    await page.click("[data-testid=mi-sel] [data-slot=select-trigger]");
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("data-open") === "true", sel);
    const opening = await sample(page, sel, 120);
    assert.ok(opening.at(-1)! > 0 && opening.at(-1)! < 1, `mid-flight after 120 ms: ${opening.at(-1)}`);
    assert.ok(await transitions(page, sel), "the bars run a transition");
    await page.keyboard.press("Escape");
    const closing = await sample(page, sel, 120);
    await page.click("[data-testid=mi-sel] [data-slot=select-trigger]");
    const reopening = await sample(page, sel, 450);
    const all = [...opening, ...closing, ...reopening];
    assert.ok(maxStep(all) < 0.2, `no snap: largest frame step ${maxStep(all).toFixed(3)}`);
    const open = await bars(page, sel);
    assert.equal(open.before.p, 1);
    assert.equal(open.before.rot, -45, "⌃: left arm rises");
    assert.equal(open.after.rot, 45);
    assert.deepEqual(seen.errors, []);
  }));

test("morph chevron: ComboBox / Autocomplete / CellSelect: first open runs mid-flight, fold up when open", () =>
  onPage(async (page) => {
    const open = async (trigger: string, sel: string, name: string, close: "Escape" | "trigger" = "Escape") => {
      await page.click(trigger);
      await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("data-open") === "true", sel);
      // First change on the resumed page: the bars transition (a re-created component would jump to 1).
      const first = await sample(page, sel, 120);
      assert.ok(
        first.some((p) => p > 0 && p < 1),
        `${name}: first open runs mid-flight (${first.map((p) => p.toFixed(2)).join(" ")})`,
      );
      await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)!, "::before").getPropertyValue("--morph-p") === "1", sel);
      assert.equal((await bars(page, sel)).before.rot, -45, name);
      // ComboBox: focus is on the trigger button after the press (Escape is the input's key): a second press closes it.
      if (close === "trigger") await page.click(trigger);
      else await page.keyboard.press("Escape");
      await page
        .waitForFunction((sel) => !document.querySelector(sel)?.hasAttribute("data-open"), sel, { timeout: 5000 })
        .catch(async () => {
          throw new Error(
            `${name}: still open after Escape (${await page.$eval(sel, (el) => el.outerHTML)}; trigger ${await page.$eval(trigger, (el) => el.getAttribute("data-open"))}; listbox ${await page.$$eval("[role=listbox]", (els) => els.length)})`,
          );
        });
      await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)!, "::before").getPropertyValue("--morph-p") === "0", sel);
    };
    await open("[data-testid=mi-cb] [data-slot=combo-box-trigger]", CHEVRONS.comboBox, "combo-box", "trigger");
    await open("[data-testid=mi-ac] [data-slot=autocomplete-trigger]", CHEVRONS.autocomplete, "autocomplete");
    await open("[data-testid=mi-cs] [data-slot=cell-select-trigger]", CHEVRONS.cellSelect, "cell-select");
  }));

test("morph chevron: reduced motion swaps instantly (data-reduce-motion and the media query)", async () => {
  await onPage(async (page) => {
    const sel = "[data-testid=mi-sel-rm] [data-slot=select-default-indicator]";
    await page.click("[data-testid=mi-sel-rm] [data-slot=select-trigger]");
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("data-open") === "true", sel);
    assert.equal(await transitions(page, sel), 0);
    assert.equal((await bars(page, sel)).before.p, 1);
  });
  await onPage(async (page) => {
    await page.click("[data-testid=mi-sel] [data-slot=select-trigger]");
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("data-open") === "true", CHEVRONS.select);
    assert.equal(await transitions(page, CHEVRONS.select), 0);
    assert.equal((await bars(page, CHEVRONS.select)).before.p, 1);
  }, "reduce");
});

test("morph chevron: a custom indicator child keeps the rotate (Select, CellSelect)", () =>
  onPage(async (page) => {
    const sel = "[data-testid=mi-sel-custom] [data-slot=select-indicator]";
    assert.equal(await page.$eval(sel, (el) => el.classList.contains("morph-chevron")), false);
    await page.click("[data-testid=mi-sel-custom] [data-slot=select-trigger]");
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("data-open") === "true", sel);
    await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)!).rotate === "180deg", sel);
    const cs = "[data-testid=mi-cs-custom] [data-slot=cell-select-indicator]";
    assert.equal(await page.$eval(cs, (el) => el.classList.contains("morph-chevron")), false);
    await page.keyboard.press("Escape");
    await page.click("[data-testid=mi-cs-custom] [data-slot=cell-select-trigger]");
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("data-open") === "true", cs);
    await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)!).rotate === "180deg", cs);
  }));

test("morph burger: lucide Menu at rest → X when open; open → close mid-flight without a jump", () =>
  onPage(async (page) => {
    const rest = await bars(page, BURGER);
    assert.equal(rest.svg, 0);
    assert.deepEqual(rest.size, [20, 20]);
    // lucide Menu at 20 px: bars 16 / 24 × 20 wide (+ stroke), top / bottom 7 / 24 × 20 off centre.
    assert.equal(rest.before.rot, 0);
    const half = (8 * 20) / 12 / 2; // translate(-50%, -50%) of the stroke-high bar, drawn 8×
    assert.ok(Math.abs(rest.before.y + half + (7 / 24) * 20) < 0.05, `top bar offset ${rest.before.y}`);
    assert.ok(Math.abs(rest.after.y + half - (7 / 24) * 20) < 0.05, `bottom bar offset ${rest.after.y}`);
    assert.equal(await transitions(page, BURGER), 0, "no first-render playback");
    await page.click("#mi-nav-toggle");
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("data-open") === "true", BURGER);
    const opening = await sample(page, BURGER, 100);
    assert.ok(
      opening.some((p) => p > 0 && p < 1),
      `first open runs mid-flight (${opening.map((p) => p.toFixed(2)).join(" ")})`,
    );
    await page.click("#mi-nav-toggle");
    const closing = await sample(page, BURGER, 80);
    await page.click("#mi-nav-toggle");
    const reopening = await sample(page, BURGER, 350);
    const all = [...opening, ...closing, ...reopening];
    assert.ok(maxStep(all) < 0.25, `no snap: largest frame step ${maxStep(all).toFixed(3)}`);
    const x = await bars(page, BURGER);
    assert.equal(x.before.rot, 45, "X");
    assert.equal(x.after.rot, -45);
    assert.ok(Math.abs(x.before.y + half) < 0.01 && Math.abs(x.after.y + half) < 0.01, "bars meet at the centre");
    assert.equal(await page.$eval(BURGER + " > span", (el) => getComputedStyle(el).opacity), "0", "middle bar faded");
  }));

test("morph burger: reduced motion swaps instantly", () =>
  onPage(async (page) => {
    await page.click("#mi-nav-toggle");
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("data-open") === "true", BURGER);
    assert.equal(await transitions(page, BURGER), 0);
    assert.equal((await bars(page, BURGER)).before.p, 1);
    assert.equal(await page.$eval(BURGER + " > span", (el) => getComputedStyle(el).opacity), "0");
  }, "reduce"));

/** Ink of an element's screenshot (sum of darkness, black on white), in CSS px². */
async function ink(page: Page, sel: string, dpr: number): Promise<number> {
  const { data, info } = await sharp(await page.locator(sel).screenshot())
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < data.length; i += info.channels) sum += (255 - (data[i]! + data[i + 1]! + data[i + 2]!) / 3) / 255;
  return sum / dpr / dpr;
}

// F2 (CHEVRON review): a 1.33 px box snapped its thickness to whole device pixels (chevron −24…−36 %, burger +20 %):
// the bars are drawn 8× and scaled down, so the stroke weight follows lucide's anti-aliased stroke.
test("morph icons: stroke weight (ink) = lucide ChevronDown / Menu / X within ±10 % at 1× and 2×", async () => {
  for (const dpr of [1, 2])
    await onPage(
      async (page) => {
        for (const name of ["chevron", "menu", "x"]) {
          const lucide = await ink(page, `#mi-ink [data-ink=${name}-lucide]`, dpr);
          const morph = await ink(page, `#mi-ink [data-ink=${name}-morph]`, dpr);
          const ratio = morph / lucide;
          console.log(`ink ${dpr}x ${name}: lucide ${lucide.toFixed(1)} morph ${morph.toFixed(1)} (${((ratio - 1) * 100).toFixed(1)} %)`);
          assert.ok(Math.abs(ratio - 1) <= 0.1, `${dpr}x ${name}: morph ink ${morph.toFixed(1)} vs lucide ${lucide.toFixed(1)}`);
        }
      },
      "no-preference",
      dpr,
    );
});
