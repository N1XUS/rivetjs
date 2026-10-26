// Build-time evaluated tailwind-variants resolvers (COMPTIME, @rivetjs/compiler `comptime.ts`): the build runs the real
// `tv(...)` definition in Node, enumerates every variant value of the definition (its variant keys' values, `true` /
// `false`, `undefined`, `null`, `""`, `0`, `0n`, numeric forms, plus one "any other string" and one "any object" sample)
// and proves, by evaluating every combination, that the table below reproduces the real resolver's output. These
// helpers only look values up in that table: no variant logic of their own. Untouched = 0 bytes (only folded modules
// import this file).
//
// Table (`TvTable`, emitted by the compiler as a JS literal):
// - `k`: variant keys; `v[i]`: key `i`'s enumerated values (NaN excluded). A value's token = its index in `v[i]`;
//   values outside it: `v[i].length` (a string / number / bigint / symbol / function: behaves like the "other string"
//   sample), `+ 1` (an object), `+ 2` (NaN).
// - `s`: slot names (a slots definition), absent for a plain / variants definition.
// - separable (`c`): output = base (`b[slot]`) joined with each key's piece for its token (`c[i][token]`, a string, or one
//   per slot), `undefined` when empty;
// - dense (`m` / `w` / `e`): per key a token → class index map, strides, and per slot the outputs (`null` = undefined).

export interface TvTable {
  readonly k: readonly string[];
  readonly v: readonly (readonly unknown[])[];
  readonly s?: readonly string[];
  readonly b?: readonly string[];
  readonly c?: readonly (readonly (string | readonly string[])[])[];
  readonly m?: readonly (readonly number[])[];
  readonly w?: readonly number[];
  readonly e?: readonly (readonly (string | null)[])[];
}

type Props = Record<string, unknown> | null | undefined;
type Merge = (core: unknown, cls: unknown, className: unknown) => unknown;

const token = (values: readonly unknown[], value: unknown): number => {
  const at = values.indexOf(value);
  if (at >= 0) return at;
  const n = values.length;
  // eslint-disable-next-line no-self-compare
  return value !== value ? n + 2 : value !== null && typeof value === "object" ? n + 1 : n;
};

/** Output of slot `si` (0 for a plain / variants definition) for `props`, slot props `sp` overriding variant values (`??`). */
export function tvSlot(table: TvTable, props: Props, si: number, sp?: Props): string | undefined {
  const keys = table.k;
  const c = table.c;
  if (c !== undefined) {
    let out = table.b![si]!;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const raw = (sp == null ? undefined : sp[key]) ?? (props == null ? undefined : props[key]);
      const piece = c[i]![token(table.v[i]!, raw)]!;
      const part = typeof piece === "string" ? piece : piece[si]!;
      if (part) out = out ? out + " " + part : part;
    }
    return out || undefined;
  }
  let at = 0;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const raw = (sp == null ? undefined : sp[key]) ?? (props == null ? undefined : props[key]);
    at += table.m![i]![token(table.v[i]!, raw)]! * table.w![i]!;
  }
  return table.e![si]![at] ?? undefined;
}

/** A plain / variants definition's output for override-free `props` (no `class` / `className`). */
export const tvCore = (table: TvTable, props?: Props): string | undefined => tvSlot(table, props, 0);

// = tailwind-variants `hasClassOverride` (3.x).
const hasOverride = (props: Props): boolean =>
  ((props == null ? undefined : props.class) != null && props!.class !== "") ||
  ((props == null ? undefined : props.className) != null && props!.className !== "");

// The override merge (tailwind-merge's `cn`, tailwind-variants' `cx`): registered by the build's merge module, which
// exactly the modules that may call a full resolver import (its definition's module never does: a page reading tables
// only never loads tailwind-merge).
let mergeCn: ((...classes: unknown[]) => unknown) | undefined;
let mergeCx: ((...classes: unknown[]) => unknown) | undefined;
/** Registers the override merge functions (the build's merge module). */
export function tvMergeWith(cn: (...classes: unknown[]) => unknown, cx: (...classes: unknown[]) => unknown): void {
  mergeCn = cn;
  mergeCx = cx;
}

const unseen = (): never => {
  throw new Error("[rivet] a class override ran in a module the build did not see (rivet({ comptime }): its merge was not provided)");
};

/** The override merge of a definition: `1` = `cn(cx(core, class, className))`, `2` = `cn(core, class, className)`. */
export const tvMerge =
  (flavour: 1 | 2): Merge =>
  (core, cls, className) => {
    if (mergeCn === undefined || mergeCx === undefined) return unseen();
    return flavour === 1 ? mergeCn(mergeCx(core, cls, className)) : mergeCn(core, cls, className);
  };

// Defer mode (`@comptime defer` imports of a `tv` wrapper module, e.g. `@rivetjs/ui`'s `cn`): the build's provider module
// registers them here; the wrapper module reads them through `tvDeferred`. Only modules that may call one of the wrapper's
// resolvers with a class override import the provider, so pages without one never load what it imports (tailwind-merge).
let provided: Record<string, Record<string, (...args: never[]) => unknown>> | undefined;

/** Registers a defer-mode module's imports under its key (the build's provider module). */
export function tvProvide(key: string, values: Record<string, (...args: never[]) => unknown>): void {
  (provided ??= {})[key] = values;
}

/** A deferred import of the defer-mode module `key`: calls the provided function (the build saw every caller). */
export const tvDeferred =
  (key: string, name: string) =>
  (...args: unknown[]): unknown =>
    ((provided?.[key]?.[name] ?? unseen) as (...a: unknown[]) => unknown)(...args);

/**
 * The full resolver (any call): the table for the core, the definition's own override behaviour (`merge`: the real
 * library function the build matched on samples) for a non-empty `class` / `className`, tailwind-variants' metadata
 * (`variantKeys`, `variants`, `extend`, …) as real data. `table` is a thunk: the defining module may still be evaluating.
 * `slotted`: the definition returns slot functions (its real result is an object).
 */
export function tvFull(table: () => TvTable, slotted: boolean, meta: Record<string, unknown>, merge: Merge): unknown {
  let t: TvTable | undefined;
  const get = () => (t ??= table());
  let resolver: (props?: Props) => unknown;
  if (slotted) {
    resolver = (props?: Props) => {
      const tb = get();
      const slots = tb.s!;
      const out: Record<string, (sp?: Props) => unknown> = {};
      for (let si = 0; si < slots.length; si++) {
        const core = tvSlot(tb, props, si);
        out[slots[si]!] = (sp?: Props) => {
          if (sp == null) return core;
          let value: unknown = core;
          for (const key in sp)
            if (key !== "class" && key !== "className" && sp[key] !== undefined) {
              value = tvSlot(tb, props, si, sp);
              break;
            }
          return hasOverride(sp) ? merge(value, sp.class, sp.className) : value;
        };
      }
      return out;
    };
  } else {
    resolver = (props?: Props) => {
      const core = tvSlot(get(), props, 0);
      return hasOverride(props) ? merge(core, props!.class, props!.className) : core;
    };
  }
  return Object.assign(resolver, meta);
}
