// COMPTIME tables by symbol (r3-testgaps#14): `buildTvTable` (comptime-eval.ts) over real tailwind-variants
// definitions, read back through the shipped helpers (`@rivetjs/runtime/comptime-tv`): separable and dense encodings
// agree with the library for random props (sentinel tokens included), the budgets refuse, and an override in a module
// the build never saw throws.
import { test } from "vitest";
import assert from "node:assert/strict";
import { cn, cx, tv } from "tailwind-variants";
import * as helper from "../../runtime/comptime-tv.ts";
import { buildTvTable, TV_BUDGET, TV_DENSE_CELLS } from "../comptime-eval.ts";

type Resolver = Parameters<typeof buildTvTable>[0];
const tw = { cn: cn as (...c: unknown[]) => unknown, cx: cx as (...c: unknown[]) => unknown };

// Deterministic samples: every enumerated value, plus the "other" kinds a table maps to its sentinel tokens.
let seed = 7;
const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
const SAMPLES: unknown[] = [undefined, null, "", "zzz", 0, 1, 0n, true, false, NaN, {}, [], "sm", "md", "lg", "a", "b", "0", Symbol.for("s")];
const randomProps = (keys: readonly string[]) => {
  const props: Record<string, unknown> = {};
  for (const key of keys) if (rand(4)) props[key] = SAMPLES[rand(SAMPLES.length)];
  return props;
};

const build = (make: () => unknown) => buildTvTable(make() as Resolver, () => make() as Resolver, helper, tw);

test("separable table: tvCore / tvFull equal the real resolver for random props (sentinel tokens included)", () => {
  const make = () =>
    tv({
      base: "inline-flex",
      variants: { size: { sm: "text-sm", md: "text-base", lg: "text-lg" }, tone: { a: "bg-red-500", b: "bg-blue-500" }, on: { true: "ring", false: "" } },
      defaultVariants: { size: "md" },
    });
  const built = build(make);
  assert.equal(built.form, "separable");
  assert.ok(built.table.c && !built.table.e);
  const real = make();
  const full = helper.tvFull(() => built.table, false, {}, helper.tvMerge(2)) as (p?: unknown) => unknown;
  for (let n = 0; n < 500; n++) {
    const props = randomProps(["size", "tone", "on"]);
    const want = real(props as never);
    assert.equal(
      helper.tvCore(built.table, props),
      want,
      JSON.stringify(props, (_k, v) => (typeof v === "bigint" ? v + "n" : v)),
    );
    assert.equal(full(props), want);
  }
});

test("dense table: a definition tailwind-merge rewrites (not base + pieces) is looked up per combination", () => {
  const make = () => tv({ base: "px-2 text-sm", variants: { size: { sm: "px-3", lg: "px-5 text-lg" }, tight: { true: "px-1" } } });
  const built = build(make);
  assert.equal(built.form, "dense");
  assert.ok(built.table.e && built.table.m && built.table.w);
  const real = make();
  for (let n = 0; n < 500; n++) {
    const props = randomProps(["size", "tight"]);
    assert.equal(helper.tvCore(built.table, props), real(props as never));
  }
});

test("slotted table: tvSlot per slot, slot props override variant values", () => {
  const make = () =>
    tv({
      slots: { root: "rounded", title: "font-bold" },
      variants: { tone: { muted: { root: "bg-gray-100", title: "text-gray-500" }, loud: { root: "bg-red-500" } }, size: { sm: { title: "text-sm" } } },
    });
  const built = build(make);
  const slots = built.slots!;
  assert.deepEqual([...slots].sort(), ["base", "root", "title"], "tailwind-variants adds the `base` slot");
  const real = make() as unknown as (p?: unknown) => Record<string, (sp?: unknown) => unknown>;
  const full = helper.tvFull(() => built.table, true, {}, helper.tvMerge(2)) as (p?: unknown) => Record<string, (sp?: unknown) => unknown>;
  for (let n = 0; n < 300; n++) {
    const props = randomProps(["tone", "size"]);
    const sp = rand(2) ? randomProps(["tone", "size"]) : undefined;
    const r = real(props),
      mine = full(props);
    for (const [si, slot] of slots.entries()) {
      assert.equal(mine[slot]!(sp), r[slot]!(sp), slot + " " + JSON.stringify([props, sp], (_k, v) => (typeof v === "bigint" ? v + "n" : v)));
      if (!sp) assert.equal(helper.tvSlot(built.table, props, si), r[slot]!());
    }
  }
});

test("budgets: past TV_BUDGET combinations or TV_DENSE_CELLS dense cells the definition is refused (runtime call stays)", () => {
  const names = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => ["v" + i, "c" + i]));
  const wide = () => tv({ variants: Object.fromEntries(Array.from({ length: 8 }, (_, k) => ["k" + k, names(6)])) });
  assert.throws(() => build(wide), new RegExp(`over the budget \\(${TV_BUDGET}\\)`));
  // Not separable (tailwind-merge drops the base padding) and more cells than the dense limit.
  const dense = () => tv({ base: "px-2", variants: Object.fromEntries(Array.from({ length: 5 }, (_, k) => ["k" + k, { ...names(6), p: "px-" + (k + 3) }])) });
  assert.throws(() => build(dense), new RegExp(`over the limit \\(${TV_DENSE_CELLS}\\)`));
});

test("an override (class / className) in a module the build never saw throws instead of guessing the merge", () => {
  const built = build(() => tv({ base: "p-1", variants: { size: { sm: "text-sm" } } }));
  const full = helper.tvFull(() => built.table, false, {}, helper.tvMerge(2)) as (p?: unknown) => unknown;
  assert.equal(full({ size: "sm" }), "p-1 text-sm", "override-free: the table");
  assert.throws(() => full({ size: "sm", class: "p-2" }), /a class override ran in a module the build did not see/);
  assert.throws(() => helper.tvDeferred("unregistered", "cn")("a"), /did not see/);
  helper.tvMergeWith(tw.cn, tw.cx);
  assert.equal(full({ size: "sm", class: "p-2" }), cn("p-1 text-sm", "p-2"));
});
