// `styles/src/utils/tv.ts` (tailwind-merge only for class overrides) vs tailwind-variants' default `tv` (`twMerge: true`,
// always merges): byte-identical output for every vendored / Rivet-authored definition × variant combination × slot,
// without and with `class` / `className` overrides (conflicting utilities included).
import { test } from "vitest";
import assert from "node:assert/strict";
import { tv as upstreamTv, cn } from "tailwind-variants";
import * as styles from "../styles/src/index.ts";
import * as components from "../styles/src/components/index.ts";

type Def = ((props?: Record<string, unknown>) => unknown) & {
  base?: unknown;
  slots?: Record<string, unknown>;
  variants?: Record<string, Record<string, unknown>>;
  compoundVariants?: unknown[];
  compoundSlots?: unknown[];
  defaultVariants?: Record<string, unknown>;
  extend?: unknown;
  variantKeys?: string[];
};

const defs = Object.entries(components as unknown as Record<string, unknown>).filter(
  (entry): entry is [string, Def] => typeof entry[1] === "function" && Array.isArray((entry[1] as Def).variantKeys),
);

/** The same definition built with upstream's always-merging `tv`, from the resolved options tv attaches. */
function upstreamOf(def: Def): Def {
  const options: Record<string, unknown> = {
    base: def.base,
    slots: def.slots,
    variants: def.variants,
    compoundVariants: def.compoundVariants,
    compoundSlots: def.compoundSlots,
    defaultVariants: def.defaultVariants,
  };
  for (const key of Object.keys(options)) if (options[key] === undefined) delete options[key];
  if (options.slots && Object.keys(options.slots).length === 0) delete options.slots;
  return upstreamTv(options as never) as unknown as Def;
}

function combinations(def: Def): Record<string, unknown>[] {
  let list: Record<string, unknown>[] = [{}];
  for (const key of Object.keys(def.variants ?? {})) {
    const values = Object.keys(def.variants![key]).map((v) => (v === "true" ? true : v === "false" ? false : v));
    const next: Record<string, unknown>[] = [];
    for (const props of list) {
      next.push(props);
      for (const value of values) next.push({ ...props, [key]: value });
    }
    list = next;
  }
  return list;
}

const OVERRIDES: Record<string, unknown>[] = [
  { class: "p-4" },
  { class: "p-2 p-4" },
  { class: "px-2 py-1 p-3" },
  { class: "text-red-500 bg-[#fff] rounded-none" },
  { class: "w-full h-auto text-sm font-bold opacity-50" },
  { class: ["p-2", "p-4"] },
  { class: { "m-2": true, "m-4": false } },
  { className: "p-4" },
  { class: "p-2", className: "p-4" },
  { class: "" },
  { class: "", className: "" },
  { class: undefined },
];

test("tv-merge: every definition × variant combination × slot = upstream always-merge output, without and with overrides", () => {
  let checked = 0;
  let combos = 0;
  const diffs: string[] = [];
  const same = (name: string, props: unknown, slot: string, a: unknown, b: unknown) => {
    checked++;
    if (a !== b) diffs.push(`${name} ${JSON.stringify(props)} ${slot}: ${JSON.stringify(a)} !== upstream ${JSON.stringify(b)}`);
  };
  assert.ok(defs.length >= 120, `only ${defs.length} definitions`);
  for (const [name, def] of defs) {
    const upstream = upstreamOf(def);
    const list = combinations(def);
    assert.ok(list.length <= 20000, `${name}: ${list.length} combinations`);
    for (const props of list) {
      combos++;
      const ours = def(props);
      const theirs = upstream(props);
      if (typeof ours !== "object" || ours === null) {
        same(name, props, "-", ours, theirs);
        for (const o of OVERRIDES) same(name, { ...props, ...o }, "-", def({ ...props, ...o }), upstream({ ...props, ...o }));
        continue;
      }
      const ourSlots = ours as Record<string, (p?: unknown) => unknown>;
      const theirSlots = theirs as Record<string, (p?: unknown) => unknown>;
      assert.deepEqual(Object.keys(ourSlots), Object.keys(theirSlots), name);
      for (const slot of Object.keys(ourSlots)) {
        same(name, props, slot, ourSlots[slot](), theirSlots[slot]());
        for (const o of OVERRIDES) same(name, { ...props, slot: o }, slot, ourSlots[slot](o), theirSlots[slot](o));
      }
    }
    // Slot-level variant overrides (recomputed slot), with and without a class override.
    const first = Object.keys(def.variants ?? {})[0];
    if (first && def.slots && Object.keys(def.slots).length > 0) {
      const ours = def() as Record<string, (p?: unknown) => unknown>;
      const theirs = upstream() as Record<string, (p?: unknown) => unknown>;
      for (const value of Object.keys(def.variants![first])) {
        for (const slot of Object.keys(ours)) {
          same(name, { [first]: value }, slot, ours[slot]({ [first]: value }), theirs[slot]({ [first]: value }));
          same(
            name,
            { [first]: value, class: "p-2 p-4" },
            slot,
            ours[slot]({ [first]: value, class: "p-2 p-4" }),
            theirs[slot]({ [first]: value, class: "p-2 p-4" }),
          );
        }
      }
    }
  }
  assert.deepEqual(diffs.slice(0, 20), []);
  assert.ok(combos >= 3000 && checked >= 150000, `${combos} combinations, ${checked} strings`);
});

test("tv-merge: overrides still go through tailwind-merge (HeroUI semantics), core strings are joined", () => {
  const { buttonVariants, cardVariants } = components;
  assert.equal(buttonVariants(), "button button--md button--primary");
  assert.equal(buttonVariants({ class: "p-2 p-4" }), "button button--md button--primary p-4");
  assert.equal((buttonVariants as (props: object) => string)({ class: "p-2", className: "p-4" }), "button button--md button--primary p-4");
  const slots = cardVariants({ variant: "secondary" });
  assert.equal(slots.base(), "card card--secondary");
  assert.equal(slots.title({ class: "px-2 px-3" }), "card__title px-3");
  assert.equal(slots.title({ class: "" }), "card__title");
  // Slot objects keep tv's per-variant cache identity.
  assert.equal(cardVariants({ variant: "secondary" }), cardVariants({ variant: "secondary" }));
  assert.equal(cn("p-2 p-4"), "p-4");
});

test("tv-merge: definitions keep tv's metadata (variantKeys / variants / slots / defaultVariants)", () => {
  const { buttonVariants, cardVariants } = components as unknown as Record<string, Def>;
  assert.ok(buttonVariants.variantKeys!.includes("variant"));
  assert.equal(buttonVariants.base, "button");
  assert.ok(cardVariants.slots && "header" in cardVariants.slots);
  assert.equal(cardVariants.defaultVariants!.variant, "default");
});

test("tv-merge: the public tv / cn stay tailwind-variants' own", () => {
  assert.equal(styles.tv, upstreamTv);
  assert.equal(styles.cn, cn);
});
