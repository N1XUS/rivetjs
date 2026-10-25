// `styles/src/utils/tv.ts` merges a one-token `class` override by joining it: valid because every core token (base, slots,
// variant values of every definition) is a class tailwind-merge does not recognise, so it never drops one. A token it
// recognises (`cn("t t") === "t"`: it dedupes its own utilities only) must be listed in `UTILITY_CORE_TOKENS` (cores holding
// one always merge). This test keeps the list exact, and checks the rejected options.
import { test } from "vitest";
import assert from "node:assert/strict";
import { cn } from "tailwind-variants";
import * as components from "../styles/src/components/index.ts";
import { tv, UTILITY_CORE_TOKENS } from "../styles/src/utils/tv.ts";

test("tv core: tailwind-merge recognises exactly UTILITY_CORE_TOKENS among the definitions' core tokens", () => {
  const tokens = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === "string") for (const token of value.split(/\s+/)) token && tokens.add(token);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  let defs = 0;
  type Def = { variantKeys?: unknown; base?: unknown; slots?: unknown; variants?: unknown };
  for (const value of Object.values(components) as unknown[]) {
    const def = value as Def;
    if (typeof value === "function" && Array.isArray(def.variantKeys)) {
      defs++;
      walk(def.base);
      walk(def.slots);
      walk(def.variants);
    }
  }
  assert.ok(defs >= 120 && tokens.size >= 1000, `${defs} definitions, ${tokens.size} tokens`);
  const recognised = [...tokens].filter((token) => cn(token + " " + token) === token).sort();
  assert.deepEqual(recognised, [...UTILITY_CORE_TOKENS].sort());
});

test("tv core: a one-token override joins (no tailwind-merge), a utility core or a multi-token override merges", async () => {
  const { buttonVariants } = components as unknown as Record<string, (props?: object) => string>;
  const { textShimmerVariants } = components as unknown as Record<string, () => { base: (props?: object) => string }>;
  assert.equal(buttonVariants({ class: "w-full" }), "button button--md button--primary w-full");
  assert.equal(buttonVariants({ class: "  w-full " }), "button button--md button--primary w-full");
  assert.equal(buttonVariants({ class: "p-2 p-4" }), "button button--md button--primary p-4");
  // `text-shimmer` reads as a text colour to tailwind-merge: a one-token override still merges (drops it, as upstream).
  const shimmer = textShimmerVariants!().base;
  assert.equal(shimmer({ class: "text-muted" }), cn(shimmer() + " text-muted"));
  assert.ok(!shimmer({ class: "text-muted" }).split(" ").includes("text-shimmer"));
});

test("tv core: options outside base / slots / variants / defaultVariants are rejected", () => {
  const make = tv as unknown as (options: object, config?: object) => unknown;
  assert.throws(() => make({ base: "a", compoundVariants: [{ size: "sm", class: "b" }] }), /compoundVariants/);
  assert.throws(() => make({ base: "a", extend: make({ base: "b" }) }), /extend/);
  assert.throws(() => make({ base: "a" }, { twMerge: false }), /no config/);
  assert.doesNotThrow(() => make({ base: "a", compoundVariants: [] }));
});
