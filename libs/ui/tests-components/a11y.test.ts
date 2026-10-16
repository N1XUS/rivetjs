// axe-core on every story route (incl. the visual matrix routes), light + dark: violations are pinned in
// `a11y.known.json` (`<route> <scheme>` → sorted rule ids). A new violation fails; a fixed one fails too until the
// list is refreshed (`RIVET_UPDATE_A11Y=1 npx vitest run --project ui-components a11y`), so the list only shrinks on
// purpose. axe-core (root devDependency, exact pin) is injected from node_modules (no @axe-core/playwright needed).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { stories, type Stories } from "./harness.ts";
import { VISUAL } from "./visual.manifest.ts";

const knownFile = fileURLToPath(new URL("./a11y.known.json", import.meta.url));
const update = process.env.RIVET_UPDATE_A11Y === "1";
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

/** Story routes: every `app/src/routes/*.tsx` (dev-server-only pages included: they build too) + `visual/<name>`. */
const ROUTES = [
  ...readdirSync(fileURLToPath(new URL("./app/src/routes/", import.meta.url)))
    .filter((f) => f.endsWith(".tsx") && !f.startsWith("_"))
    .map((f) => "/" + (f === "index.tsx" ? "" : f.slice(0, -4))),
  ...VISUAL.map((entry) => "/visual/" + entry.name),
].sort();

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("a11y: axe violations per story route = a11y.known.json", { timeout: 900_000 }, async () => {
  const found: Record<string, string[]> = {};
  for (const scheme of ["light", "dark"] as const) {
    const context = await s.browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: scheme, reducedMotion: "reduce" });
    for (const route of ROUTES) {
      const page = await context.newPage();
      try {
        await page.goto(s.origin + route, { waitUntil: "networkidle" });
        await page.evaluate((scheme) => {
          document.documentElement.dataset.theme = scheme;
          document.documentElement.classList.toggle("dark", scheme === "dark");
        }, scheme);
        await page.addScriptTag({ content: axeSource });
        const ids = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run(ctx: Document, opts: object): Promise<{ violations: { id: string }[] }> } }).axe;
          // Page-shell rules judge the story harness (title, h1, landmarks: one `main` per story + the layout's), not components.
          const off = ["document-title", "page-has-heading-one", "landmark-main-is-top-level", "landmark-no-duplicate-main", "landmark-unique", "region"];
          const result = await axe.run(document, { resultTypes: ["violations"], rules: Object.fromEntries(off.map((id) => [id, { enabled: false }])) });
          return result.violations.map((v) => v.id).sort();
        });
        if (ids.length) found[`${route} ${scheme}`] = ids;
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
  if (update) return writeFileSync(knownFile, JSON.stringify(found, null, 2) + "\n");
  const known = JSON.parse(readFileSync(knownFile, "utf8")) as Record<string, string[]>;
  assert.deepEqual(found, known);
});
