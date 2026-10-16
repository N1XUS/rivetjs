// Visual baselines (identity lane): every `visual.manifest.ts` route at 1280 + 390 px, light + dark, plus RTL and
// keyboard-focus shots, compared pixel for pixel (PNG bytes) with `__screenshots__/visual/<platform>/`. Baselines are per
// platform (font rasterisation differs): a platform without baselines records nothing and skips (CI on Linux until
// recorded there). Record / refresh: `RIVET_UPDATE_SCREENSHOTS=1 npx vitest run --project ui-components visual`; a
// look tweak updates only the PNGs its `styles/TWEAKS.md` row names (`git status libs/ui/tests-components/__screenshots__`).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { BrowserContext, Page } from "playwright";
import { stories, type Stories } from "./harness.ts";
import { VISUAL, type VisualEntry } from "./visual.manifest.ts";

const dir = fileURLToPath(new URL(`./__screenshots__/visual/${process.platform}/`, import.meta.url));
const update = process.env.RIVET_UPDATE_SCREENSHOTS === "1";
const recorded = existsSync(dir);

let s: Stories;
beforeAll(async () => {
  s = await stories();
  if (update) mkdirSync(dir, { recursive: true });
});
afterAll(async () => s?.close());

const WIDTHS = [1280, 390] as const;
const SCHEMES = ["light", "dark"] as const;

/** Compares (or records) one PNG; on a mismatch writes `<name>.actual.png` next to the baseline. */
function check(name: string, png: Buffer, failures: string[]): void {
  const file = dir + name + ".png";
  const actual = dir + name + ".actual.png";
  if (update) {
    writeFileSync(file, png);
    rmSync(actual, { force: true });
    return;
  }
  if (!existsSync(file)) return void failures.push(`${name}: no baseline`);
  if (Buffer.compare(readFileSync(file), png) !== 0) {
    writeFileSync(actual, png);
    failures.push(`${name}: differs (see ${name}.actual.png)`);
  } else rmSync(actual, { force: true });
}

async function shoot(context: BrowserContext, entry: VisualEntry, scheme: string, mode: "plain" | "rtl" | "focus"): Promise<Buffer> {
  const page: Page = await context.newPage();
  try {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Theme + direction before first paint (switching after load would capture colour transitions mid-way).
    await page.addInitScript(
      ([scheme, rtl]) => {
        const apply = () => {
          document.documentElement.dataset.theme = scheme as string;
          document.documentElement.classList.toggle("dark", scheme === "dark");
          if (rtl) document.documentElement.dir = "rtl";
        };
        if (document.documentElement) apply();
        else
          new MutationObserver((_, observer) => {
            if (!document.documentElement) return;
            apply();
            observer.disconnect();
          }).observe(document, { childList: true });
      },
      [scheme, mode === "rtl"] as const,
    );
    await page.addInitScript(() =>
      document.addEventListener("rivet:resume-error", (e) => ((window as unknown as { __resumeError: unknown }).__resumeError = (e as CustomEvent).detail)),
    );
    await page.goto(s.origin + "/visual/" + entry.name, { waitUntil: "networkidle" });
    const failed = await page.evaluate(() => (window as unknown as { __resumeError?: unknown }).__resumeError);
    if (failed) throw new Error(`${entry.name}: resume error ${JSON.stringify(failed)}`);
    if (entry.open && mode === "plain") {
      await page.click(entry.open, { timeout: 5000 });
      // Deterministic: wait for the overlay itself. `waitForLoadState("networkidle")` resolves at once when the page was
      // already idle, so a slow chunk load (loaded host) left the snapshot without the open menu / dialog (flake).
      // Toast: its baseline holds the trigger page only (no toast in the snapshot), so there is no overlay to wait for.
      if (entry.name !== "toast")
        await page.waitForFunction(
          () => document.querySelector('[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"], [data-slot="navbar-menu"][data-open="true"]'),
          undefined,
          {
            timeout: 5000,
          },
        );
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600); // overlay enter transition (animations are frozen at their end by the screenshot)
    }
    if (mode === "focus") {
      // Keyboard focus on the first focusable inside the matrix (not the layout nav): focus the container, then Tab.
      await page.evaluate(() => {
        const root = document.getElementById("visual")!;
        root.tabIndex = -1;
        root.focus();
      });
      await page.keyboard.press("Tab");
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300); // ring / colour transitions started by the focus move or the overlay opening
    const png = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
    if (errors.length) throw new Error(`${entry.name}: page errors ${errors.join("; ")}`);
    return png;
  } finally {
    await page.close();
  }
}

for (const entry of VISUAL)
  test.skipIf(!recorded && !update)(`visual: ${entry.name}`, async () => {
    const failures: string[] = [];
    for (const width of WIDTHS)
      for (const scheme of SCHEMES) {
        const context = await s.browser.newContext({ viewport: { width, height: 720 }, colorScheme: scheme, deviceScaleFactor: 1, reducedMotion: "reduce" });
        try {
          check(`${entry.name}-${width}-${scheme}`, await shoot(context, entry, scheme, "plain"), failures);
          if (width === 1280 && entry.focus) check(`${entry.name}-focus-${width}-${scheme}`, await shoot(context, entry, scheme, "focus"), failures);
          if (width === 1280 && scheme === "light" && entry.rtl)
            check(`${entry.name}-rtl-${width}-${scheme}`, await shoot(context, entry, scheme, "rtl"), failures);
        } finally {
          await context.close();
        }
      }
    assert.deepEqual(failures, []);
  });
