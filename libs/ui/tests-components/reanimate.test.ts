// Enter animations play once per new node (`/reanimate`): typing into InputOTP rolls in only the new slot value, a
// NumberStepper change (controlled `#r-nst` and uncontrolled `#r-nsu`; none at load on the resumed page, none with reduced
// motion) rolls only the changed characters, a Stepper step change draws the check only on the newly completed
// step. Resumed (server-rendered) page and client-created mount (`#r-mount`): node identity (expando marks) + counted
// `animationstart` events per animation name.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>, reducedMotion: "reduce" | "no-preference" = "no-preference"): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 1400 }, reducedMotion });
  try {
    const seen = watch(page);
    // Every animationstart, by animation name + the probe root (`data-probe`: `r-otp`, `r-nst`, `r-st`, `-c` when client-created).
    await page.addInitScript(() => {
      const w = window as unknown as { __anims: string[] };
      w.__anims = [];
      document.addEventListener(
        "animationstart",
        (e) => {
          const root = (e.target as Element).closest("[data-probe]");
          w.__anims.push(`${root?.getAttribute("data-probe")}:${e.animationName}`);
        },
        true,
      );
    });
    await page.goto(s.origin + "/reanimate");
    await page.waitForLoadState("networkidle");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const anims = (page: Page, key: string) => page.evaluate((k) => (window as unknown as { __anims: string[] }).__anims.filter((a) => a === k).length, key);
// Finite animations done (the fake caret blinks forever).
const settled = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity));
const markAll = (page: Page, sel: string) => page.$$eval(sel, (els) => els.forEach((el) => ((el as unknown as Record<string, boolean>).__rvMark = true)));
const marks = (page: Page, sel: string) => page.$$eval(sel, (els) => els.map((el) => (el as unknown as Record<string, boolean>).__rvMark === true));
const texts = (page: Page, sel: string) => page.$$eval(sel, (els) => els.map((el) => el.textContent));

async function otp(page: Page, root: string): Promise<void> {
  const values = `#${root} [data-slot=input-otp-slot-value]`;
  await page.click(`#${root} input`);
  await page.keyboard.type("1");
  await page.waitForFunction((sel) => document.querySelectorAll(sel).length === 1, values);
  await settled(page);
  assert.equal(await anims(page, `${root}:slot-value-in`), 1);
  await markAll(page, values);
  for (const [i, ch] of ["2", "3", "4"].entries()) {
    await page.keyboard.type(ch);
    await page.waitForFunction(([sel, n]) => document.querySelectorAll(sel!).length === n, [values, i + 2] as const);
    await settled(page);
    // Earlier values keep their nodes; only the new one rolls in.
    assert.deepEqual(await marks(page, values), [...Array(i + 1).fill(true), false], `after typing ${ch}`);
    assert.equal(await anims(page, `${root}:slot-value-in`), i + 2, `after typing ${ch}`);
    await markAll(page, values);
  }
  assert.deepEqual(await texts(page, values), ["1", "2", "3", "4"]);
}

async function numberStepper(page: Page, root: string): Promise<void> {
  const chars = `#${root} [data-slot=number-stepper-char]`;
  const inc = `#${root} [data-slot=number-stepper-increment-button]`;
  assert.deepEqual(await texts(page, chars), ["1", "1", "8"]);
  await markAll(page, chars);
  const before = await anims(page, `${root}:number-stepper-roll`);
  await page.click(inc);
  await page.waitForFunction((sel) => Array.from(document.querySelectorAll(sel), (e) => e.textContent).join("") === "119", chars);
  await settled(page);
  // 118 → 119: the two leading characters are kept, only the last one rolls.
  assert.deepEqual(await marks(page, chars), [true, true, false]);
  assert.equal(await anims(page, `${root}:number-stepper-roll`), before + 1);
  await markAll(page, chars);
  await page.click(inc);
  await page.waitForFunction((sel) => Array.from(document.querySelectorAll(sel), (e) => e.textContent).join("") === "120", chars);
  await settled(page);
  // 119 → 120: the leading "1" is kept.
  assert.deepEqual(await marks(page, chars), [true, false, false]);
  assert.equal(await anims(page, `${root}:number-stepper-roll`), before + 3);
}

// Raw input vs animated display (user bug 2026-10-09: a stepper press focuses the input, as React Aria, and the display
// switched to the raw input on mere focus, so the roll ran unseen). The display shows the committed value unless the
// user edits the text; `animationstart` alone is not enough (it also fires under `visibility: hidden`).
const view = (page: Page, root: string) =>
  page.evaluate((r) => {
    const el = document.getElementById(r)!;
    const input = el.querySelector("input")!;
    const display = el.querySelector("[data-slot=number-stepper-display]")!;
    return {
      focused: document.activeElement === input,
      display: getComputedStyle(display).visibility === "visible",
      raw: getComputedStyle(input).color !== "rgba(0, 0, 0, 0)",
    };
  }, root);
const shown = (page: Page, root: string, text: string) =>
  page.waitForFunction(([sel, t]) => Array.from(document.querySelectorAll(sel!), (e) => e.textContent).join("") === t, [
    `#${root} [data-slot=number-stepper-char]`,
    text,
  ] as const);

async function focusedSteps(page: Page, root: string, rolls = true): Promise<void> {
  const inc = `#${root} [data-slot=number-stepper-increment-button]`;
  const roll = `${root}:number-stepper-roll`;
  const base = await anims(page, roll);
  const expect = (n: number) => (rolls ? base + n : 0);
  await page.click(inc);
  await shown(page, root, "119");
  await settled(page);
  // (The first press of a resumed page runs its handler cold: focus may not have moved yet.)
  assert.deepEqual({ ...(await view(page, root)), focused: true }, { focused: true, display: true, raw: false }, "after the first +");
  assert.equal(await anims(page, roll), expect(1));
  await page.click(inc);
  await shown(page, root, "120");
  await settled(page);
  // The press focused the input; the display still shows the value and the changed characters rolled.
  assert.deepEqual(await view(page, root), { focused: true, display: true, raw: false }, "after the second +");
  assert.equal(await anims(page, roll), expect(3));
  await page.keyboard.press("ArrowUp");
  await shown(page, root, "121");
  await settled(page);
  assert.deepEqual(await view(page, root), { focused: true, display: true, raw: false }, "after ArrowUp");
  assert.equal(await anims(page, roll), expect(4));
  // A press in the text places the caret: raw input text while editing; the display keeps the committed value.
  await page.click(`#${root} input`);
  assert.deepEqual(await view(page, root), { focused: true, display: false, raw: true }, "caret placed");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("42");
  assert.deepEqual(await view(page, root), { focused: true, display: false, raw: true }, "typing");
  assert.equal(await page.inputValue(`#${root} input`), "42");
  await shown(page, root, "121");
  // Enter commits: the display is back and the edit rolls in.
  const typed = await anims(page, roll);
  await page.keyboard.press("Enter");
  await shown(page, root, "42");
  await settled(page);
  assert.deepEqual(await view(page, root), { focused: true, display: true, raw: false }, "after Enter");
  if (rolls) assert.ok((await anims(page, roll)) > typed, "the committed edit rolls in");
  else assert.equal(await anims(page, roll), 0);
  // Typing then a stepper press: the step ends the edit (committed 47 → 48).
  await page.click(`#${root} input`);
  // (Home / End are spinbutton steps to the bounds; ArrowLeft / ArrowRight move the caret.)
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("7");
  assert.equal((await view(page, root)).raw, true, "editing again");
  await page.click(inc);
  await shown(page, root, "48");
  await settled(page);
  assert.deepEqual(await view(page, root), { focused: true, display: true, raw: false }, "+ after typing");
  // Blur ends an edit too.
  await page.click(`#${root} input`);
  await page.keyboard.type("1");
  await page.keyboard.press("Tab");
  assert.equal((await view(page, root)).display, true, "after blur");
}

async function stepper(page: Page, root: string, next: string): Promise<void> {
  const checks = `#${root} [data-slot=stepper-check]`;
  for (let n = 1; n <= 3; n++) {
    await markAll(page, checks);
    await page.click(next);
    await page.waitForFunction(([sel, k]) => document.querySelectorAll(sel!).length === k, [checks, n] as const);
    await settled(page);
    // Checks of the steps completed before stay; only the newly completed step draws.
    assert.deepEqual(await marks(page, checks), [...Array(n - 1).fill(true), false], `after step ${n}`);
    assert.equal(
      await anims(page, `${root}:stepper-check-draw`),
      n,
      `after step ${n}: ${await page.evaluate(() => (window as unknown as { __anims: string[] }).__anims.join())}`,
    );
  }
}

test("resumed: InputOTP rolls in only the typed slot value", () => onPage((page) => otp(page, "r-otp")));
test("resumed: NumberStepper rolls only the changed characters", () => onPage((page) => numberStepper(page, "r-nst")));
test("resumed: uncontrolled NumberStepper rolls only the changed characters", () => onPage((page) => numberStepper(page, "r-nsu")));
test("resumed: NumberStepper characters do not roll at load; decrement rolls the changed one", () =>
  onPage(async (page) => {
    for (const root of ["r-nst", "r-nsu"]) {
      await settled(page);
      assert.equal(await anims(page, `${root}:number-stepper-roll`), 0, root);
      assert.equal(await page.locator(`#${root} [data-roll]`).count(), 0, root);
      await page.click(`#${root} [data-slot=number-stepper-decrement-button]`);
      await page.waitForFunction(
        (sel) => Array.from(document.querySelectorAll(sel), (e) => e.textContent).join("") === "117",
        `#${root} [data-slot=number-stepper-char]`,
      );
      await settled(page);
      assert.equal(await anims(page, `${root}:number-stepper-roll`), 1, root);
      assert.equal(await page.locator(`#${root} [data-roll]`).count(), 1, root);
    }
  }));
test("resumed: reduced motion — a changed NumberStepper character is a new span, no animation runs", () =>
  onPage(async (page) => {
    await page.click("#r-nsu [data-slot=number-stepper-increment-button]");
    await page.waitForFunction(() => Array.from(document.querySelectorAll("#r-nsu [data-slot=number-stepper-char]"), (e) => e.textContent).join("") === "119");
    assert.equal(await page.locator("#r-nsu [data-roll]").count(), 1);
    await page.waitForTimeout(300);
    assert.equal(await anims(page, "r-nsu:number-stepper-roll"), 0);
  }, "reduce"));
test("resumed: Stepper draws the check only on the newly completed step", () => onPage((page) => stepper(page, "r-st", "#r-st-next")));
test("resumed: NumberStepper keeps the animated display on a focused input; raw text only while editing", () =>
  onPage(async (page) => {
    await focusedSteps(page, "r-nsu");
    await focusedSteps(page, "r-nst");
  }));
test("resumed: reduced motion — focused steps keep the display, nothing animates", () => onPage((page) => focusedSteps(page, "r-nsu", false), "reduce"));

async function mounted(page: Page): Promise<void> {
  await page.click("#r-mount");
  await page.waitForSelector("#r-st-c");
  await settled(page);
}
test("client-created: InputOTP rolls in only the typed slot value", () => onPage(async (page) => (await mounted(page), await otp(page, "r-otp-c"))));
test("client-created: NumberStepper rolls only the changed characters", () =>
  onPage(async (page) => {
    await mounted(page);
    // Client-created characters roll in at mount.
    assert.equal(await anims(page, "r-nst-c:number-stepper-roll"), 3);
    await numberStepper(page, "r-nst-c");
  }));
test("client-created: uncontrolled NumberStepper rolls only the changed characters", () =>
  onPage(async (page) => {
    await mounted(page);
    assert.equal(await anims(page, "r-nsu-c:number-stepper-roll"), 3);
    await numberStepper(page, "r-nsu-c");
  }));
test("client-created: NumberStepper keeps the animated display on a focused input; raw text only while editing", () =>
  onPage(async (page) => (await mounted(page), await focusedSteps(page, "r-nsu-c"))));
test("client-created: Stepper draws the check only on the newly completed step", () =>
  onPage(async (page) => (await mounted(page), await stepper(page, "r-st-c", "#r-st-next-c"))));
