// Ported from HeroUI v3.2.6 packages/react/src/components/chip/chip.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; React types → Rivet JSX types.
// - `ChipContext` carries plain data `{ color, size, variant }` (`color` / `variant` defaulted, `size` has no default variant:
//   `null` = none) instead of the tv `slots` object: resumable token `rv-ui-chip`, default `{}` (= outside a `Chip`); parts look the
//   slots up in a module-level memo (`slotsFor`, key `${color}|${size}|${variant}`).
// - The root's element (and the `ChipLabel` wrapper of a string / number child, `withLabel`) is built inside the provider (Rivet JSX is
//   eager). Children that are lazy slots (`{expr}`) resolve in a child accessor first (`../../utils/with-label.tsx`).
// - Live props: the root reads `color` / `size` / `variant` / `class` lazily (`splitLive` = runtime `splitProps`); the context value's fields are
//   getters over them (readers see plain data; resume encodes the values read), parts read the context inside their class
//   binding, so a changed prop updates the classes without re-creating nodes.
// - Bodies cast `props` to the default-element shape before splitting (generic intersection = TS2590).
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ChipVariants } from "../../../styles/src/components/chip/index.ts";
import { chipVariants } from "../../../styles/src/components/chip/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { withLabel } from "../../utils/with-label.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Chip Context
 * -----------------------------------------------------------------------------------------------*/
interface ChipContext {
  color?: ChipVariants["color"];
  /** `null`: no size (chipVariants has no default size). */
  size?: ChipVariants["size"] | null;
  variant?: ChipVariants["variant"];
}

const ChipContext = createContext<ChipContext>({});

type ChipSlots = ReturnType<typeof chipVariants>;

/** Module-level memo per `color|size|variant` (tv slot functions are pure). */
const SLOTS: Record<string, ChipSlots> = {};
const slotsFor = (color: ChipVariants["color"], size: ChipVariants["size"] | null | undefined, variant: ChipVariants["variant"]): ChipSlots =>
  (SLOTS[`${color}|${size ?? "none"}|${variant}`] ??= chipVariants({ color, size: size ?? undefined, variant }));

/** Upstream `use(ChipContext).slots`: `undefined` outside a `Chip`. Read inside the part's class binding (live getters). */
const slotsOf = (context: ChipContext): ChipSlots | undefined => {
  const color = context.color;
  return color === undefined ? undefined : slotsFor(color, context.size, context.variant);
};

/* -------------------------------------------------------------------------------------------------
 * Chip Root
 * -----------------------------------------------------------------------------------------------*/
interface ChipRootProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children: Content;
  class?: string;
  /** Chip color. */
  color?: ChipVariants["color"];
  /** Chip size. */
  size?: ChipVariants["size"];
  /** Chip variant. */
  variant?: ChipVariants["variant"];
}

/** `ChipRoot` props for the default element (`span`). */
type ChipRootSpanProps = ChipRootProps & Omit<JSX.IntrinsicElements["span"], keyof ChipRootProps>;

const ChipRoot = <E extends keyof JSX.IntrinsicElements = "span">(props: ChipRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ChipRootSpanProps, ["children", "class", "color", "size", "variant"]);
  const contextValue: ChipContext = {
    get color() {
      return local.color === undefined ? "default" : local.color;
    },
    get size() {
      return local.size ?? null;
    },
    get variant() {
      return local.variant === undefined ? "secondary" : local.variant;
    },
  };

  const content = () => (
    <dom.span {...rest} class={composeSlotClassName(slotsOf(contextValue)!.base, local.class)} data-slot="chip">
      {withLabel(local.children as Content, ChipLabel)}
    </dom.span>
  );

  return (
    <Provider token={ChipContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Chip Label
 * -----------------------------------------------------------------------------------------------*/
interface ChipLabelProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `ChipLabel` props for the default element (`span`). */
type ChipLabelSpanProps = ChipLabelProps & Omit<JSX.IntrinsicElements["span"], keyof ChipLabelProps>;

const ChipLabel = <E extends keyof JSX.IntrinsicElements = "span">(props: ChipLabelProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ChipLabelSpanProps, ["class"]);
  const context = useContext(ChipContext);

  // The label slot class is the same for every variant: read untracked, so a live `color` / `size` on the root does not make
  // this a live class binding whose captures (the spread props) include the rendered children — a resumed server page's
  // `{expr}` text binding record is not serializable ("capture #0 rendered content").
  const base = untrack(() => slotsOf(context)?.label);
  return <dom.span class={composeSlotClassName(base, local.class)} data-slot="chip-label" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ChipRoot, ChipLabel };

export type { ChipRootProps, ChipLabelProps, ChipRootSpanProps, ChipLabelSpanProps };
