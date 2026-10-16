// Ported from HeroUI v3.2.6 packages/react/src/components/badge/badge.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; React types → Rivet JSX types.
// - `BadgeContext` carries plain data `{ color, placement, size, variant }` (all defaulted) instead of the tv `slots` object: resumable
//   token `rv-ui-badge`, default `{}`; parts look the slots up in a module-level memo (`slotsFor`, key on the defaulted values),
//   `undefined` outside a `Badge` (= upstream `slots?.label`). `React.useMemo` → a context object whose fields are getters over the
//   live props (readers see plain data; resume encodes the values read).
// - The root's element (and the `BadgeLabel` wrapper of a string / number child, `withLabel`) is built inside the provider (Rivet JSX is
//   eager). Children that are lazy slots (`{expr}`) resolve in a child accessor first (`../../utils/with-label.tsx`).
// - Live props: parts read props lazily (`splitLive` = runtime `splitProps`, never a destructure) and compute classes in the JSX
//   attribute; parts read the context inside their class binding, so a changed prop updates the classes without re-creating nodes.
// - Bodies cast `props` to the default-element shape before splitting (generic intersection = TS2590).
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { cx } from "tailwind-variants";

import type { BadgeVariants } from "../../../styles/src/components/badge/index.ts";
import { badgeVariants } from "../../../styles/src/components/badge/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { withLabel } from "../../utils/with-label.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Badge Context
 * -----------------------------------------------------------------------------------------------*/
interface BadgeContext {
  color?: BadgeVariants["color"];
  placement?: BadgeVariants["placement"];
  size?: BadgeVariants["size"];
  variant?: BadgeVariants["variant"];
}

const BadgeContext = resumableContext(createContext<BadgeContext>({}, { id: "rv-ui-badge" }));

type BadgeSlots = ReturnType<typeof badgeVariants>;

/** Module-level memo per `color|placement|size|variant` (tv slot functions are pure). */
const SLOTS: Record<string, BadgeSlots> = {};
const slotsFor = (
  color: BadgeVariants["color"],
  placement: BadgeVariants["placement"],
  size: BadgeVariants["size"],
  variant: BadgeVariants["variant"],
): BadgeSlots => (SLOTS[`${color}|${placement}|${size}|${variant}`] ??= badgeVariants({ color, placement, size, variant }));

/** Upstream `use(BadgeContext).slots`: `undefined` outside a `Badge`. Read inside the part's class binding (live getters). */
const slotsOf = (context: BadgeContext): BadgeSlots | undefined => {
  const color = context.color;
  return color === undefined ? undefined : slotsFor(color, context.placement, context.size, context.variant);
};

/* -------------------------------------------------------------------------------------------------
 * Badge Anchor
 * -----------------------------------------------------------------------------------------------*/
interface BadgeAnchorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  class?: string;
  children: Content;
}

/** `BadgeAnchor` props for the default element (`span`). */
type BadgeAnchorSpanProps = BadgeAnchorProps & Omit<JSX.IntrinsicElements["span"], keyof BadgeAnchorProps>;

const BadgeAnchor = <E extends keyof JSX.IntrinsicElements = "span">(props: BadgeAnchorProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as BadgeAnchorSpanProps, ["children", "class"]);

  return (
    <dom.span {...rest} class={cx("badge-anchor", local.class) ?? undefined} data-slot="badge-anchor">
      {local.children}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Badge Root
 * -----------------------------------------------------------------------------------------------*/
interface BadgeRootProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
  /** Badge color. */
  color?: BadgeVariants["color"];
  /** Badge placement. */
  placement?: BadgeVariants["placement"];
  /** Badge size. */
  size?: BadgeVariants["size"];
  /** Badge variant. */
  variant?: BadgeVariants["variant"];
}

/** `BadgeRoot` props for the default element (`span`). */
type BadgeRootSpanProps = BadgeRootProps & Omit<JSX.IntrinsicElements["span"], keyof BadgeRootProps>;

const BadgeRoot = <E extends keyof JSX.IntrinsicElements = "span">(props: BadgeRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as BadgeRootSpanProps, ["children", "class", "color", "placement", "size", "variant"]);
  const contextValue: BadgeContext = {
    get color() {
      return local.color === undefined ? "default" : local.color;
    },
    get placement() {
      return local.placement === undefined ? "top-right" : local.placement;
    },
    get size() {
      return local.size === undefined ? "md" : local.size;
    },
    get variant() {
      return local.variant === undefined ? "primary" : local.variant;
    },
  };

  const content = () => (
    <dom.span {...rest} class={composeSlotClassName(slotsOf(contextValue)!.base, local.class)} data-slot="badge">
      {withLabel(local.children as Content, BadgeLabel)}
    </dom.span>
  );

  return (
    <Provider token={BadgeContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Badge Label
 * -----------------------------------------------------------------------------------------------*/
interface BadgeLabelProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `BadgeLabel` props for the default element (`span`). */
type BadgeLabelSpanProps = BadgeLabelProps & Omit<JSX.IntrinsicElements["span"], keyof BadgeLabelProps>;

const BadgeLabel = <E extends keyof JSX.IntrinsicElements = "span">(props: BadgeLabelProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as BadgeLabelSpanProps, ["class"]);
  const context = useContext(BadgeContext);

  // The label slot class is the same for every variant: read untracked, so a live `color` / `size` on the root does not make
  // this a live class binding whose captures (the spread props) include the rendered children — a resumed server page's
  // `{expr}` text binding record is not serializable ("capture #0 rendered content").
  const base = untrack(() => slotsOf(context)?.label);
  return <dom.span class={composeSlotClassName(base, local.class)} data-slot="badge-label" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { BadgeRoot, BadgeLabel, BadgeAnchor };

export type { BadgeRootProps, BadgeLabelProps, BadgeAnchorProps, BadgeRootSpanProps, BadgeLabelSpanProps, BadgeAnchorSpanProps };
