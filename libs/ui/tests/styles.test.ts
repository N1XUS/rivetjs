import { test } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { cardVariants } from "../styles/src/index.ts";

const styles = new URL("../styles/", import.meta.url);

test("vendored styles: one CSS file per upstream component + index entries", () => {
  const css = readdirSync(new URL("components/", styles)).filter((f) => f.endsWith(".css"));
  assert.ok(css.includes("card.css") && css.includes("button.css"));
  assert.ok(css.length >= 80, `only ${css.length} component css files`);
  for (const f of ["index.css", "base/base.css", "themes/default/index.css", "utilities/index.css", "variants/index.css"])
    assert.ok(existsSync(new URL(f, styles)), f);
});

test("vendored styles: tv() card slots produce upstream class strings", () => {
  const s = cardVariants({ variant: "secondary" });
  assert.equal(s.base(), "card card--secondary");
  assert.equal(s.header(), "card__header");
  assert.equal(s.title({ class: "x" }), "card__title x");
});

test("forked styles: every derived file carries the Apache-2.0 header; changed ones point at TWEAKS.md", () => {
  const tweaks = readFileSync(new URL("TWEAKS.md", styles), "utf8");
  assert.match(tweaks, /^# libs\/ui\/styles tweaks/m);
  assert.match(tweaks, /^\| TW-001 \|/m);
  assert.ok(!existsSync(new URL("PATCHES.md", styles)), "PATCHES.md is retired (TWEAKS.md)");
  const header = readFileSync(new URL("src/components/card/card.styles.ts", styles), "utf8");
  assert.match(header, /Apache-2\.0.*NextUI Inc\./s);
  // A tweaked vendored file: line 1 = provenance, line 2 = the TWEAKS pointer (Apache-2.0 §4b).
  const [line1, line2] = readFileSync(new URL("components/button-group.css", styles), "utf8").split("\n");
  assert.match(line1!, /^\/\* Ported from HeroUI v3\.2\.6 /);
  assert.equal(line2, "/* Rivet: modified, see TWEAKS.md */");
});

// TW-150: an `<Icon>` without `size` (kit default 24 x 24) takes the chip icon box; explicit sizes are not matched.
test("chip: default-sized icons get the 14 px icon box (16 px in lg)", () => {
  const css = readFileSync(new URL("out/chip.css", styles), "utf8").replace(/\s+/g, " ");
  assert.match(css, /\.chip > svg\[width="24"\]\[height="24"\] \{ flex: none; width: 14px; height: 14px; \}/);
  assert.match(css, /\.chip--lg > svg\[width="24"\]\[height="24"\] \{ width: 16px; height: 16px; \}/);
});
