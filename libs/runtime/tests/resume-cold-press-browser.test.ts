// Resume: a cold press's mousedown focus move (lane RESUME-PINS, resume fuzz T31 pins /forms, /number-field,
// /radio-group). The browser moves focus to the pressed element at mousedown, before a handler that cancels it (RA
// useRadio's label) or swallows the move (`preventFocusOnPress` / RA `preventFocus`) loaded. The move stays native (a
// mouse focus: no `:focus-visible`, whose heuristic a held default + script focus would flip on for every later script
// focus); once the chunk loaded the runtime puts focus back on the element focused at dispatch, replays the handlers and
// then focuses as the default would (`focusVisible: false`) unless one canceled it.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Page } from "playwright";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/cold-press-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/cold-press.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/cold-press.tsx").code);
const manifest: ResumeManifest = {
  hash: "cold-press",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
// Every handler chunk lands late: each press below is cold for its own chunk.
const delays = Object.fromEntries(Object.keys(byComponent).map((path) => [path, path.startsWith("/c/Cyc") ? 1500 : 400]));

const active = (page: Page): Promise<string> => page.evaluate(() => document.activeElement?.id || document.activeElement?.localName || "");
const counted = (page: Page, key: string): Promise<unknown> =>
  page.waitForFunction((k) => (globalThis as unknown as Record<string, number>)[k] === 1, key, { timeout: 5000 });

async function cold(run: (page: Page) => Promise<void>): Promise<void> {
  await withPage(
    files,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      assert.ok(await page.evaluate(() => document.querySelector("script[type='rivet/state']")?.getAttribute("data-events")?.includes("mousedown")));
      await page.focus("#before");
      await run(page);
      assert.deepEqual(errors, []);
    },
    { delays },
  );
}

const ring = (page: Page): Promise<boolean> => page.evaluate(() => !!document.activeElement?.matches(":focus-visible"));

test("resume: a cold mousedown a handler cancels gives focus back (radio label shape)", async () => {
  assert.ok(files["/c/Held.js"], "the handler has a chunk of its own");
  await cold(async (page) => {
    await page.click("#held");
    await counted(page, "__held");
    await page.waitForFunction(() => document.activeElement?.id === "before", undefined, { timeout: 2000 });
  });
});

test("resume: a cold mousedown's default focus is the native mouse focus (no focus-visible ring)", async () => {
  await cold(async (page) => {
    await page.click("#plain");
    assert.equal(await active(page), "plain");
    await counted(page, "__plain");
    await page.waitForTimeout(50);
    assert.equal(await active(page), "plain");
    assert.equal(await ring(page), false, "mouse focus");
    // A later script focus keeps the mouse heuristic (a held default + script focus turned it on for the page).
    await page.evaluate(() => document.querySelector<HTMLElement>("#held")!.focus());
    assert.equal(await ring(page), false, "script focus after a mouse press");
    await page.keyboard.press("Tab");
    assert.equal(await ring(page), true, "Tab after it");
  });
});

test("resume: a cold press handler moving focus elsewhere keeps it there (preventFocusOnPress shape)", async () => {
  await cold(async (page) => {
    await page.click("#moves");
    await counted(page, "__moves");
    await page.waitForTimeout(100);
    assert.equal(await active(page), "field");
  });
});

test("resume: a cold press whose handler swallows the coming focus move keeps focus (RA preventFocus shape)", async () => {
  await cold(async (page) => {
    await page.click("#guard");
    await counted(page, "__guard");
    await page.waitForTimeout(100);
    assert.equal(await active(page), "before");
  });
});

test("resume: a cold mousedown on a non-focusable element blurs the active element", async () => {
  await cold(async (page) => {
    await page.click("#blur");
    await counted(page, "__blur");
    await page.waitForFunction(() => document.activeElement === document.body, undefined, { timeout: 2000 });
  });
});

test("resume: a cold mousedown a handler cancels on a non-focusable element keeps focus where it was", async () => {
  await cold(async (page) => {
    await page.click("#keep");
    await counted(page, "__keep");
    await page.waitForFunction(() => document.activeElement?.id === "before", undefined, { timeout: 2000 });
    await page.waitForTimeout(100);
    assert.equal(await active(page), "before");
  });
});

test("resume: a cold press on an href-less link: the default's target is the focusable ancestor", async () => {
  await cold(async (page) => {
    await page.click("#anchor");
    await counted(page, "__inert");
    // The handler sees focus where a loaded page has it (the plain `tabIndex` walk stopped at the link, which reports
    // 0, and never put focus back), then the default's focus follows.
    assert.equal(await page.evaluate(() => (globalThis as unknown as Record<string, string>).__inertSaw), "before");
    await page.waitForFunction(() => document.activeElement?.id === "inert", undefined, { timeout: 2000 });
  });
});

test("resume: a cold press on an href-less link a handler cancels keeps focus where it was", async () => {
  await cold(async (page) => {
    await page.click("#anchor-keep");
    await counted(page, "__inertKeep");
    await page.waitForFunction(() => document.activeElement?.id === "before", undefined, { timeout: 2000 });
    await page.waitForTimeout(100);
    assert.equal(await active(page), "before");
  });
});

test("resume: a held cold link click replays as a copy of the user's click (not a virtual `el.click()`)", async () => {
  await cold(async (page) => {
    // A listener loaded meanwhile (the router, cdk focus-visible) sees the replayed click: detail 0 / pointerType ""
    // would count as a virtual (keyboard / screen reader) click.
    await page.evaluate(() => {
      const seen: string[] = ((globalThis as unknown as { __clicks: string[] }).__clicks = []);
      document.addEventListener("click", (e) => e.isTrusted || seen.push(e.detail + " " + (e as PointerEvent).pointerType), true);
    });
    await page.click("#follow");
    await counted(page, "__follow");
    await page.waitForFunction(() => location.hash === "#followed", undefined, { timeout: 2000 });
    assert.deepEqual(await page.evaluate(() => (globalThis as unknown as { __clicks: string[] }).__clicks), ["1 mouse"]);
  });
});

test("resume: a cold press whose pointerdown handler focuses the target keeps it (menu trigger shape)", async () => {
  await cold(async (page) => {
    await page.click("#grab");
    await counted(page, "__grabPressed");
    const seen = await page.evaluate(() => {
      const g = globalThis as unknown as Record<string, string>;
      return [g.__grabDown, g.__grabMouse];
    });
    // As on a loaded page: the pointerdown handler runs with focus still on `#before`, the mousedown one after it focused
    // the trigger (focus is not put back to `#before` once the press's pointerdown replayed).
    assert.deepEqual(seen, ["before", "grab"]);
    await page.waitForTimeout(100);
    assert.equal(await active(page), "grab");
  });
});

test("resume: two cold presses queued: a canceled one never takes focus, the next press's handler focuses its target", async () => {
  await cold(async (page) => {
    await page.evaluate(() => {
      const g = globalThis as unknown as Record<string, number>;
      g.__twoAFocus = 0;
      document.addEventListener("focusin", (e) => (e.target as Element).id === "two-a" && g.__twoAFocus++, true);
    });
    // Both presses land before any chunk (400 ms each): A's native mouse focus is the only time it holds focus.
    await page.click("#two-a");
    await page.click("#two-b");
    await counted(page, "__twoBm");
    await page.waitForTimeout(100);
    assert.equal(await active(page), "two-b");
    assert.equal(await page.evaluate(() => (globalThis as unknown as Record<string, number>).__twoAFocus), 1);
  });
});

test("resume: cold presses A, B, A (canceled) then C: the focus-back walk ends, C keeps focus", async () => {
  await cold(async (page) => {
    await page.evaluate(() => {
      const g = globalThis as unknown as Record<string, number>;
      g.__cycA = g.__cycB = 0;
      document.addEventListener(
        "focusin",
        (e) => {
          const id = (e.target as Element).id;
          if (id === "cyc-a") g.__cycA++;
          if (id === "cyc-b") g.__cycB++;
        },
        true,
      );
    });
    // Its chunks land 1.5 s late: all four presses are queued cold.
    for (const id of ["#cyc-a", "#cyc-b", "#cyc-a", "#cyc-c"]) await page.click(id);
    await counted(page, "__cycC");
    await page.waitForTimeout(100);
    assert.equal(await active(page), "cyc-c");
    // Only the native mouse focus of each press (A twice, B once): no replay focuses a canceled stepper again.
    assert.deepEqual(
      await page.evaluate(() => {
        const g = globalThis as unknown as Record<string, number>;
        return [g.__cycA, g.__cycB];
      }),
      [2, 1],
    );
  });
});

test("resume: a cold mousedown on text entry keeps its native default (focus + caret at once)", async () => {
  await cold(async (page) => {
    await page.click("#text");
    assert.equal(await active(page), "text");
    await counted(page, "__text");
    await page.keyboard.type("ab");
    assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("#text")!.value), "ab");
  });
});

test("resume: a cold Tab focuses with the focus-visible ring", async () => {
  await cold(async (page) => {
    await page.keyboard.press("Tab");
    assert.equal(await ring(page), true);
  });
});

test("resume: the loader records the last input modality before any chunk ran (window.__rvIM, cdk focus-visible)", async () => {
  await cold(async (page) => {
    const modality = () => page.evaluate(() => (window as Window & { __rvIM?: string }).__rvIM);
    await page.click("#held");
    assert.equal(await modality(), "mouse");
    await page.keyboard.press("Tab");
    assert.equal(await modality(), "keyboard");
    await page.mouse.click(5, 5);
    await page.keyboard.press("Shift");
    await page.keyboard.press("Control+a");
    assert.equal(await modality(), "mouse", "a lone modifier / a Control chord is no keyboard modality");
  });
});
