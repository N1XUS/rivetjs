// Rivet-authored (NOT vendored from @heroui/styles; TWEAKS.md row): the `tv` every `*.styles.ts` definition imports.
// Same output as tailwind-variants' default `tv` (`twMerge: true`; tests/tv-merge.test.ts enumerates every definition ×
// variant combination × slot × override, byte for byte), from a small resolver of its own instead of tailwind-variants'
// `tv` runtime (ZERO B3: −2.2…−3.5 KB gz on every ui frame). The definitions use only `base` / `slots` /
// `variants` / `defaultVariants` (no `extend`, compounds or config: rejected here, the test scans them all).
// Class strings join (tailwind-variants' own `cx`); tailwind-merge runs only on a `class` / `className` override, and only
// when the result can differ from the join: every core token is a component class tailwind-merge does not recognise
// (tests/tv-core-bem.test.ts; `UTILITY_CORE_TOKENS` lists the exceptions), so `cn(core, override)` = `core + " " +
// cn(override)`, and a one-token override (most call sites: `class="w-96"`) merges with nothing. That also skips
// tailwind-merge's lazy class-map build (≈ 1.6 ms on the first merge of a page). The public `tv` / `cn` (`../index.ts`,
// `@rivetjs/ui`) stay tailwind-variants' own.
// tailwind-merge on demand (ZERO UI-JS2): the server and dev builds merge with it always (`#tv-merge` = `merge-on.ts`); a
// production browser bundle starts without it (`merge-off.ts`) and merges once `./tv-merge.ts` registered it. The compiler
// (`@rivetjs/compiler` `class-merge.ts`) makes every module that can hand a resolver an override tailwind-merge would change
// import `@rivetjs/ui/tv-merge`; any other override is a tailwind-merge fixed point, so its join is the merge.
import type { TV } from "tailwind-variants";

// `cx` = tailwind-variants' own, ported (`./cx.ts`): upstream's shares its module with tailwind-merge. ui modules take
// `cx` from here (not from `tailwind-variants` / `/lite`: those carry tailwind-merge or upstream's `tv` runtime).
import { cx } from "./cx.ts";
import { merge as initialMerge } from "#tv-merge";

export { cx };

let merge: ((joined: string) => string | undefined) | null = initialMerge as ((joined: string) => string | undefined) | null;
/** @internal `./tv-merge.ts`: registers tailwind-merge (a module whose overrides it may change imports that module). */
export const provideMerge = (fn: (joined: string) => string | undefined): void => {
  merge ??= fn;
};

type ClassProps = { class?: unknown; className?: unknown; [variant: string]: unknown } | null | undefined;
type Values = Record<string, unknown>;
type Options = {
  base?: unknown;
  slots?: Record<string, unknown>;
  variants?: Record<string, Values>;
  defaultVariants?: Record<string, unknown>;
  [unsupported: string]: unknown;
};

/** Core tokens tailwind-merge recognises as utilities (kept in sync by tests/tv-core-bem.test.ts): a core holding one merges. */
export const UTILITY_CORE_TOKENS: readonly string[] = ["text-shimmer"];
const UTILITY_CORE = new RegExp("(?:^|\\s)(?:" + UTILITY_CORE_TOKENS.join("|") + ")(?=\\s|$)");

// = tailwind-variants `hasClassOverride` (the condition its own override merge runs on).
const hasOverride = (props: ClassProps): boolean =>
  props != null && ((props.class != null && props.class !== "") || (props.className != null && props.className !== ""));

/** The final class of a core string under `props`' override: joined, merged with tailwind-merge when it can matter. */
const withOverride = (core: string | undefined, props: ClassProps): string | undefined => {
  if (!hasOverride(props)) return core;
  const joined = cx(core, props!.class as never, props!.className as never);
  if (typeof joined !== "string") return merge ? merge(joined as never) : joined;
  const override = cx(props!.class as never, props!.className as never);
  // One override token (or none) next to an inert core: nothing for tailwind-merge to drop.
  if ((override === undefined || override.indexOf(" ") < 0) && (core === undefined || !UTILITY_CORE.test(core))) return joined;
  return merge ? merge(joined) : joined;
};

// = tailwind-variants `falsyToString`.
const keyOf = (value: unknown): unknown => (value === false ? "false" : value === true ? "true" : value === 0 ? "0" : value);
const isEmpty = (values: unknown): boolean => {
  if (!values || typeof values !== "object") return true;
  for (const _ in values) return false;
  return true;
};

/** Fingerprint of the variant props (null: a value that is not a plain primitive, uncached). */
const fingerprint = (keys: readonly string[], props: ClassProps): string | null => {
  if (props == null) return "";
  let out = "";
  for (const key of keys) {
    const value = props[key];
    const type = typeof value;
    if (value !== undefined && value !== null && type !== "string" && type !== "number" && type !== "boolean") return null;
    out += (value === undefined ? "u" : value === null ? "n" : type[0] + String(value)) + "\0";
  }
  return out;
};
const LIMIT = 256;

export const tv = ((options: Options, config?: unknown) => {
  for (const key of ["extend", "compoundVariants", "compoundSlots"])
    if (options[key] != null && !(Array.isArray(options[key]) && (options[key] as unknown[]).length === 0))
      throw new TypeError("ui tv: no " + key);
  if (config != null) throw new TypeError("ui tv: no config");
  const base = options.base;
  const variants = options.variants ?? {};
  const defaults = options.defaultVariants ?? {};
  const variantKeys = Object.keys(variants);
  const compiled = variantKeys.map((key) => ({ key, values: variants[key]!, empty: isEmpty(variants[key]) }));
  // = tailwind-variants `getVariantValue`: slot props first, then props, then the default; `undefined` → the "false" key.
  const valueOf = (variant: (typeof compiled)[number], props: ClassProps, slotProps?: ClassProps): unknown => {
    if (variant.empty) return null;
    const prop = slotProps?.[variant.key] ?? props?.[variant.key];
    if (prop === null) return null;
    const key = keyOf(prop);
    if (typeof key === "object") return null;
    return variant.values[((key != null ? key : keyOf(defaults[variant.key])) as string) || "false"];
  };
  const hasSlots = options.slots !== undefined;
  let component: ((props?: ClassProps) => unknown) & Record<string, unknown>;
  if (!hasSlots) {
    let plain: string | undefined | null = null;
    let cache = new Map<string, string | undefined>();
    const core = (props: ClassProps): string | undefined => {
      if (!compiled.length) return plain === null ? (plain = cx(base as never)) : plain;
      const id = fingerprint(variantKeys, props);
      if (id !== null) {
        const hit = cache.get(id);
        if (hit !== undefined || cache.has(id)) return hit;
      }
      const classes: unknown[] = [];
      for (const variant of compiled) {
        const value = valueOf(variant, props);
        if (value) classes.push(value);
      }
      const result = cx(base as never, classes as never);
      if (id !== null) {
        if (cache.size >= LIMIT) cache = new Map();
        cache.set(id, result);
      }
      return result;
    };
    component = ((props?: ClassProps) => withOverride(core(props), props)) as typeof component;
  } else {
    const slots: Record<string, unknown> = { base: typeof base === "string" || base == null ? base : cx(base as never), ...options.slots };
    const slotKeys = Object.keys(slots);
    const compute = (slot: string, props: ClassProps, slotProps?: ClassProps): string | undefined => {
      const classes: unknown[] = [];
      for (const variant of compiled) {
        const value = valueOf(variant, props, slotProps) as unknown;
        const own = slot === "base" && typeof value === "string" ? value : value && (value as Record<string, unknown>)[slot];
        if (own) classes.push(own);
      }
      return cx(slots[slot] as never, classes as never);
    };
    let cache = new Map<string, Record<string, (slotProps?: ClassProps) => unknown>>();
    const result = (props: ClassProps) => {
      const out: Record<string, (slotProps?: ClassProps) => unknown> = {};
      for (const slot of slotKeys) {
        const core = compute(slot, props);
        out[slot] = (slotProps?: ClassProps) => {
          if (slotProps == null) return core;
          for (const key in slotProps)
            if (key !== "class" && key !== "className" && slotProps[key] !== undefined) return withOverride(compute(slot, props, slotProps), slotProps);
          return withOverride(core, slotProps);
        };
      }
      return out;
    };
    component = ((props?: ClassProps) => {
      const id = fingerprint(variantKeys, props);
      if (id === null) return result(props);
      let hit = cache.get(id);
      if (hit === undefined) {
        if (cache.size >= LIMIT) cache = new Map();
        cache.set(id, (hit = result(props)));
      }
      return hit;
    }) as typeof component;
  }
  // tailwind-variants' metadata (tests and docs tooling read it).
  component.variantKeys = variantKeys;
  component.extend = null;
  component.base = base;
  component.slots = hasSlots ? { base: typeof base === "string" || base == null ? base : cx(base as never), ...options.slots } : {};
  component.variants = variants;
  component.defaultVariants = defaults;
  component.compoundSlots = [];
  component.compoundVariants = [];
  return component;
}) as unknown as TV;
