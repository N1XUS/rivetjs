// Region branches (resumed pages): every Show / Switch a region read creates directly is recorded with its slot (creation
// order); the browser's re-creation of the region hands slot i to the i-th direct `_show` / `_switch`, so each branch whose
// match (and read value) holds keeps its server nodes — next to a keyed For's rows, around nested Shows, for keyed values
// and Switch matches. A region with one branch keeps the single-spec encoding. One page per case (`resume/branches-fixture.tsx`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { Page } from "playwright";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/branches-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/branches.tsx");
const server = await importServer<Record<string, () => ServerValue>>(compileResume(source, "server", "src/branches.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const manifest: ResumeManifest = {
  hash: "branches",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const base: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

const html = (name: string) => resumableToString(() => server[name]!(), { manifest });
/** Region entries ("#") of a rendered page's state. */
const regions = (page: string): unknown[][] => {
  const state = JSON.parse(/<script type="rivet\/state"[^>]*>([\s\S]*?)<\/script>/.exec(page)![1]!) as { b: unknown[][] };
  return state.b.filter((entry) => entry[1] === "#");
};

/** Load `name` resumed, mark every element under `root`, then per step click `button` and report which marked elements
 * (by class) are still the server's, plus the text of `root`. */
async function run(name: string, root: string, steps: string[]): Promise<{ kept: string[]; text: string; errors: string[] }[]> {
  const files = { ...base, "/": "<!doctype html><html><head></head><body>" + (await html(name)) + "</body></html>" };
  return withPage(files, async (page: Page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    await page.evaluate((r) => document.querySelectorAll(r + " *").forEach((e) => ((e as unknown as { __kept: boolean }).__kept = true)), root);
    const out = [];
    for (const button of steps) {
      const before = await page.evaluate((r) => document.querySelector(r)!.innerHTML, root);
      await page.click(button);
      await page.waitForFunction(([r, b]) => document.querySelector(r!)!.innerHTML !== b, [root, before], { timeout: 1500 }).catch(() => {});
      out.push(
        await page.evaluate(
          ([r, e]) => ({
            kept: [...document.querySelectorAll(r + " *")].filter((el) => (el as unknown as { __kept?: boolean }).__kept).map((el) => el.className),
            text: document.querySelector(r)!.textContent!,
            errors: e as string[],
          }),
          [root, errors] as const,
        ),
      );
    }
    return out;
  });
}

test("server: one spec for a region with one branch, an array with slot skips for several", async () => {
  const single = regions(await html("Single")).find((entry) => entry[8] !== undefined)!;
  assert.ok(!Array.isArray(single[8]) && typeof single[8] === "object" && "w" in (single[8] as object), JSON.stringify(single));
  assert.ok(!("s" in (single[8] as object)));
  // Nested: the outer Show (constant condition) has a slot but no branch; the inner one none; second / third adoptable.
  const nested = regions(await html("Nested")).find((entry) => entry[8] !== undefined)!;
  const specs = nested[8] as { w: number; k: number; s?: number }[];
  assert.ok(Array.isArray(specs), JSON.stringify(nested));
  assert.deepEqual(
    specs.map((s) => [s.k, s.s ?? 0]),
    [
      [0, 1],
      [0, 0],
    ],
  );
  // Mix: rows at [8], branches after them at [10] (fallback of the second Show adoptable: k -1).
  const mix = regions(await html("Mix")).find((entry) => entry[8] !== undefined)!;
  assert.ok(Array.isArray(mix[10]), JSON.stringify(mix));
  assert.deepEqual(
    (mix[10] as { k: number }[]).map((s) => s.k),
    [0, -1, 0],
  );
});

test("Shows around a keyed For: rows and held branches keep their nodes, a changed match rebuilds", async () => {
  const [go, add, back] = await run("Mix", ".box", [".go", ".add", ".go"]);
  assert.deepEqual(go!.errors, []);
  assert.equal(go!.text, "1ab23");
  assert.deepEqual(go!.kept, ["s s1", "row a", "row b", "s s3"]);
  assert.equal(add!.text, "1abc23");
  assert.deepEqual(add!.kept, ["s s1", "row a", "row b", "s s3"]);
  assert.equal(back!.text, "1abc3");
  assert.deepEqual(back!.kept, ["s s1", "row a", "row b", "s s3"]);
});

test("a Show inside another Show's branch takes no slot: later direct Shows adopt their own branch", async () => {
  const [go, back] = await run("Nested", ".nest", [".go", ".go"]);
  assert.deepEqual(go!.errors, []);
  assert.equal(go!.text, "in2nd3rd");
  // The outer Show (no server branch) and its content are re-created; the second and third keep theirs.
  assert.deepEqual(go!.kept, ["second", "third"]);
  assert.equal(back!.text, "f2nd3rd");
  assert.deepEqual(back!.kept, ["second", "third"]);
});

test("keyed Shows and a Switch: a changed value / match rebuilds only that branch", async () => {
  const [go, back] = await run("Keyed", ".k", [".go", ".go"]);
  assert.deepEqual(go!.errors, []);
  assert.equal(go!.text, "zyzby");
  assert.deepEqual(go!.kept, ["kb", "by"]);
  assert.equal(back!.text, "xyxby");
  assert.deepEqual(back!.kept, ["kb", "by"]);
});

test("one Show in a region (single spec) still adopts", async () => {
  const [go] = await run("Single", ".one", [".go"]);
  assert.deepEqual(go!.errors, []);
  assert.deepEqual(go!.kept, ["only"]);
});

test("a read steered by a signal outside its Shows adopts no branch: no Show takes another's nodes", async () => {
  assert.deepEqual((regions(await html("Steered")).find((entry) => entry[8] !== undefined)![8] as { k: number | null }).k, null);
  const [go] = await run("Steered", ".steer", [".go"]);
  assert.deepEqual(go!.errors, []);
  assert.equal(go!.text, "BA");
  assert.deepEqual(go!.kept, []);
});

test("eager For each / Show when (getters on the server resume target): keys kept, rows and held branches adopted", async () => {
  const entry = regions(await html("EagerMix")).find((e) => e[8] !== undefined)!;
  assert.deepEqual(
    (entry[10] as { k: number | null }[]).map((s) => s.k),
    [0, -1],
    JSON.stringify(entry),
  );
  const [go, add] = await run("EagerMix", ".eager", [".go", ".add"]);
  assert.deepEqual(go!.errors, []);
  assert.equal(go!.text, "1ab2");
  assert.deepEqual(go!.kept, ["s s1", "row a", "row b"]);
  assert.equal(add!.text, "1abc2");
  assert.deepEqual(add!.kept, ["s s1", "row a", "row b"]);
});
