// `will-change` guard (WILL-CHANGE 2026-10-27, TWEAKS.md TW-179): a component stylesheet (`styles/components/*.css`) sets
// `will-change` (declaration or `@apply will-change-*`) only inside a transient state block — `[data-entering]`,
// `[data-exiting]` (overlay enter / exit) or `[data-active]` (holo card tilt) — or on a listed element with its reason.
// A permanent hint holds one compositor layer per element for as long as it is rendered (measured: 70 calendar cells
// = 70 layers, a closed year grid = 200), and a hint set in the same frame as the change it prepares does nothing.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../styles/components/", import.meta.url);

const TRANSIENT = /\[data-(entering|exiting|active)(=|\])/;

/** Permanent hints kept (file → selector), by reason. */
const ALLOWED: { reason: string; uses: Record<string, string> }[] = [
  {
    reason: "drag targets mounted only while open: the inline drag transform moves every pointermove (one layer per open panel)",
    uses: { drawer: ".drawer__dialog", sheet: ".sheet__dialog" },
  },
];

/** `will-change` sites of a stylesheet: the selector chain of the enclosing blocks. */
function sites(css: string): string[][] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack: string[] = [];
  const found: string[][] = [];
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "{") {
      stack.push(source.slice(start, i).trim());
      start = i + 1;
    } else if (c === "}") {
      stack.pop();
      start = i + 1;
    } else if (c === ";") {
      if (/(^|[\s:])will-change(-|\s*:)/.test(source.slice(start, i))) found.push([...stack]);
      start = i + 1;
    }
  }
  return found;
}

test("will-change only in transient state blocks or listed elements", () => {
  const allowed = new Map<string, string>();
  for (const { uses } of ALLOWED) for (const [file, selector] of Object.entries(uses)) allowed.set(file, selector);
  const bad: string[] = [];
  const used = new Set<string>();
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".css"))) {
    const file = name.slice(0, -4);
    for (const chain of sites(readFileSync(new URL(name, dir), "utf8"))) {
      if (chain.some((s) => TRANSIENT.test(s))) continue;
      const selector = allowed.get(file);
      if (selector && chain.at(-1) === selector) {
        used.add(file);
        continue;
      }
      bad.push(`${name}: ${chain.join(" > ")}`);
    }
  }
  assert.deepEqual(bad, [], "permanent will-change: scope it to the state that animates, or list it with a reason");
  assert.deepEqual(
    [...allowed.keys()].filter((f) => !used.has(f)),
    [],
    "stale ALLOWED entries",
  );
});
