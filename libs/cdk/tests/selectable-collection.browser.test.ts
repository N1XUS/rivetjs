// Ported from react-aria test/selection/useSelectableCollection.test.js, Apache-2.0, © Adobe.
// Runs the `List` story fixture (fixtures/selection-list.ts) in Chromium.
import { afterAll as after, beforeAll as before, beforeEach, describe, it } from "vitest";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright";
import type { ListProps } from "./fixtures/selection-list.ts";

// Upstream runs on a non-Mac jsdom (Control); on macOS the same shortcuts use Option.
const MOD = process.platform === "darwin" ? "Alt" : "Control";

const ITEMS = [{ label: "Paco de Lucia" }, { label: "Vicente Amigo" }, { label: "Gerardo Nunez" }];
const KEYED = ITEMS.map((item) => ({ ...item, key: item.label }));

let browser: Browser;
let page: Page;
let bundle: string;

before(async () => {
  const out = await build({
    entryPoints: [new URL("./fixtures/selection-list.ts", import.meta.url).pathname],
    bundle: true,
    format: "iife",
    write: false,
    platform: "browser",
    define: { "process.env.NODE_ENV": '"test"' },
  });
  bundle = out.outputFiles[0]!.text;
  browser = await chromium.launch({ headless: true });
});
after(async () => browser?.close());

beforeEach(async () => {
  page?.close();
  page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.setContent(`<!doctype html><button id="before">before</button><div id="root"></div>`);
  await page.addScriptTag({ content: bundle });
});

/** Render one List per props entry, separated by a "focus stop" button (same as the upstream fragments). */
const render = (...lists: ListProps[]) =>
  page.evaluate((all) => {
    const root = document.getElementById("root")!;
    const mount = (globalThis as any).mountList;
    (globalThis as any).lists = all.map((props, i) => {
      if (i > 0) {
        const stop = document.createElement("button");
        stop.textContent = "focus stop";
        stop.id = "stop";
        root.appendChild(stop);
      }
      const host = document.createElement("div");
      root.appendChild(host);
      return mount(host, props);
    });
  }, lists);

/** aria-selected of each option of list `n`. */
const selected = (n = 0) =>
  page.evaluate((n) => [...document.querySelectorAll('[role="listbox"]')[n]!.querySelectorAll('[role="option"]')].map((o) => o.getAttribute("aria-selected") === "true"), n);

/** Text of the focused option (list index, label). */
const active = () =>
  page.evaluate(() => {
    const el = document.activeElement!;
    const lists = [...document.querySelectorAll('[role="listbox"]')];
    return { list: lists.findIndex((l) => l.contains(el)), text: el.textContent };
  });

const changes = (n = 0) => page.evaluate((n) => (globalThis as any).lists[n].changes.length, n);

/** Synthetic pointer sequence, as fireEvent does upstream. */
const press = (n: number, index: number, pointerType: "virtual" | "touch") =>
  page.evaluate(
    ({ n, index, pointerType }) => {
      const el = document.querySelectorAll('[role="listbox"]')[n]!.querySelectorAll('[role="option"]')[index] as HTMLElement;
      const init = { bubbles: true, cancelable: true, composed: true, button: 0, pointerType, pointerId: pointerType === "touch" ? 1 : 0, isPrimary: true, width: pointerType === "touch" ? 1 : 0, height: pointerType === "touch" ? 1 : 0 };
      el.dispatchEvent(new PointerEvent("pointerdown", init));
      el.dispatchEvent(new PointerEvent("pointerup", init));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
    },
    { n, index, pointerType },
  );

const tab = async () => {
  await page.focus("#before");
  await page.keyboard.press("Tab");
};

describe("useSelectableCollection (react-aria)", () => {
  it("selects the first item it focuses if selectOnFocus", async () => {
    await render({ items: ITEMS, selectionMode: "single" });
    assert.deepEqual(await selected(), [false, false, false]);
    await tab();
    assert.deepEqual(await active(), { list: 0, text: "Paco de Lucia" });
    assert.deepEqual(await selected(), [true, false, false]);
  });

  for (const [autoFocus, index] of [["first", 0], ["last", 2]] as const) {
    it(`selects the autofocused item if selectOnFocus with autoFocus=${autoFocus}`, async () => {
      await render({ items: ITEMS, selectionMode: "single", autoFocus });
      assert.equal((await active()).text, ITEMS[index]!.label);
      assert.equal((await selected())[index], true);
    });
  }

  it("does not change the selection when autofocusing an already selected collection", async () => {
    await render({ items: KEYED, selectionMode: "single", autoFocus: "first", defaultSelectedKeys: ["Gerardo Nunez"] });
    assert.deepEqual(await selected(), [false, false, true]);
  });

  it("can navigate without replacing the selection in multiple selection selectOnFocus", async () => {
    await render({ items: ITEMS, selectionMode: "multiple", selectionBehavior: "replace" });
    assert.deepEqual(await selected(), [false, false, false]);
    await tab();
    assert.equal((await active()).text, "Paco de Lucia");
    assert.deepEqual(await selected(), [true, false, false]);
    await page.keyboard.press(`${MOD}+ArrowDown`);
    assert.equal((await active()).text, "Vicente Amigo");
    assert.deepEqual(await selected(), [true, false, false]);
    await page.keyboard.press(`${MOD}+ArrowDown`);
    assert.equal((await active()).text, "Gerardo Nunez");
    assert.deepEqual(await selected(), [true, false, false]);
    await page.keyboard.press("Space");
    assert.deepEqual(await selected(), [false, false, true]);
  });

  it("wraps focus with ArrowUp and ArrowDown when shouldFocusWrap is set", async () => {
    await render({ items: ITEMS, selectionMode: "single", shouldFocusWrap: true });
    await tab();
    assert.equal((await active()).text, "Paco de Lucia");
    await page.keyboard.press("ArrowUp");
    assert.equal((await active()).text, "Gerardo Nunez");
    await page.keyboard.press("ArrowDown");
    assert.equal((await active()).text, "Paco de Lucia");
  });

  it("navigates by page with PageDown and PageUp", async () => {
    await render({ items: ITEMS, selectionMode: "single" });
    await tab();
    assert.equal((await active()).text, "Paco de Lucia");
    await page.keyboard.press("PageDown");
    assert.equal((await active()).text, "Gerardo Nunez");
    await page.keyboard.press("PageUp");
    assert.equal((await active()).text, "Paco de Lucia");
  });

  for (const [type, pointerType] of [["VO Events", "virtual"], ["Touch Pointer Events", "touch"]] as const) {
    describe(`always uses toggle for ${type}`, () => {
      it("uses toggle mode when the interaction is touch", async () => {
        await page.setViewportSize({ width: 700, height: 800 });
        await render({ items: ITEMS, selectionMode: "multiple", selectionBehavior: "replace" });
        assert.deepEqual(await selected(), [false, false, false]);
        await press(0, 0, pointerType);
        assert.deepEqual(await selected(), [true, false, false]);
        await press(0, 2, pointerType);
        assert.deepEqual(await selected(), [true, false, true]);
      });

      it("focuses first/last selected item on focus enter and does not change the selection", async () => {
        const props: ListProps = { items: KEYED.map((item, i) => ({ ...item, key: "i" + (i + 1) })), selectionMode: "multiple", selectionBehavior: "replace", defaultSelectedKeys: ["i2", "i3"] };
        await render(props, props);
        await page.click("#stop");
        await page.keyboard.press("Tab");
        assert.deepEqual(await active(), { list: 1, text: "Vicente Amigo" });
        await page.click("#stop");
        await page.keyboard.press("Shift+Tab");
        assert.deepEqual(await active(), { list: 0, text: "Gerardo Nunez" });
        assert.equal(await changes(0), 0);
        assert.equal(await changes(1), 0);
      });
    });
  }
});
