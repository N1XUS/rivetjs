// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no scroll area, only ScrollShadow). Behaviour + parts = Radix UI
// ScrollArea (@radix-ui/react-scroll-area 1.3.0, MIT, © 2022 WorkOS) through `@rivetjs/cdk/scroll-area`; look = HeroUI
// scrollbar tokens and conventions (vendored-format tv slots in `styles/src/components/scroll-area/`, BEM CSS
// `styles/components/scroll-area.css`, both Rivet-authored).
// Rivet:
// - Every part is the cdk part with the `scroll-area__*` slot class + `data-slot`; same elements, props and state
//   attributes (`data-orientation`, `data-state`) as the cdk (= Radix) parts.
// - `variant` picks the cdk visibility `type`: `hover` (default: overlay scrollbars while the pointer is over the area) /
//   `always`; an explicit `type` (`auto` / `scroll` too) wins. `size` sets the scrollbar thickness (`sm` 6 px, `md` 10 px).
// - `shadow`: the ScrollShadow fade on the viewport, CSS only (vendored `scroll-shadow` classes in their scroll-driven
//   `data-scroll-shadow-mode="auto"` form: no measuring, no script; engines without scroll timelines show no fade).
// - `Scrollbar` without children renders a default `Thumb`.
// - Read once at mount (the cdk parts split `type` / `class` at creation): no live `variant` / `size` / `class`.
// - Resumed pages: the cdk area loads no JavaScript until the pointer enters it, a wheel / scroll / focus reaches it
//   (`variant="always"` / `type="auto"`: when it comes into view).
import { createContext, useContext } from "@rivetjs/reactivity";
import {
  ScrollArea as ScrollAreaPrimitive,
  ScrollAreaCorner as ScrollAreaCornerPrimitive,
  ScrollAreaScrollbar as ScrollAreaScrollbarPrimitive,
  ScrollAreaThumb as ScrollAreaThumbPrimitive,
  ScrollAreaViewport as ScrollAreaViewportPrimitive,
} from "@rivetjs/cdk/scroll-area";
import type {
  ScrollAreaCornerProps as ScrollAreaCornerPrimitiveProps,
  ScrollAreaProps as ScrollAreaPrimitiveProps,
  ScrollAreaScrollbarProps as ScrollAreaScrollbarPrimitiveProps,
  ScrollAreaThumbProps as ScrollAreaThumbPrimitiveProps,
  ScrollAreaType,
  ScrollAreaViewportProps as ScrollAreaViewportPrimitiveProps,
} from "@rivetjs/cdk/scroll-area";
import { Provider } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ScrollAreaVariants } from "../../../styles/src/components/scroll-area/index.ts";
import { scrollAreaVariants } from "../../../styles/src/components/scroll-area/index.ts";
import { scrollShadowVariants } from "../../../styles/src/components/scroll-shadow/index.ts";
import { splitLive } from "../../utils/live.tsx";

/** The parts' slots (no per-part variant: `size` / `variant` are root modifiers): one tv call per module. */
const SLOTS = scrollAreaVariants();
const ROOT_SLOTS: Record<string, ReturnType<typeof scrollAreaVariants>> = {};
const rootSlots = (size: ScrollAreaSize, variant: ScrollAreaVariant) => (ROOT_SLOTS[`${size}|${variant}`] ??= scrollAreaVariants({ size, variant }));
const SHADOW_CLASS = {
  vertical: scrollShadowVariants({ hideScrollBar: true, orientation: "vertical" }).base(),
  horizontal: scrollShadowVariants({ hideScrollBar: true, orientation: "horizontal" }).base(),
};

type ScrollAreaSize = NonNullable<ScrollAreaVariants["size"]>;
type ScrollAreaVariant = NonNullable<ScrollAreaVariants["variant"]>;
/** The fade orientation of `shadow` (`true` = `"vertical"`). */
type ScrollAreaShadow = boolean | "vertical" | "horizontal";

/* -------------------------------------------------------------------------------------------------
 * ScrollArea Context
 * -----------------------------------------------------------------------------------------------*/
interface ScrollAreaContext {
  shadow?: ScrollAreaShadow;
  shadowSize?: number;
}

/** The root's viewport options (plain data, resumable). */
const ScrollAreaContext = createContext<ScrollAreaContext>({});

/* -------------------------------------------------------------------------------------------------
 * ScrollArea Root
 * -----------------------------------------------------------------------------------------------*/
interface ScrollAreaRootProps extends Omit<ScrollAreaPrimitiveProps, "class" | "type"> {
  class?: string;
  /** Scrollbar thickness. @default "md" */
  size?: ScrollAreaSize;
  /** `hover`: overlay scrollbars while the pointer is over the area; `always`: always visible. @default "hover" */
  variant?: ScrollAreaVariant;
  /** The cdk (Radix) visibility type; overrides the one `variant` picks (`auto`, `scroll` too). */
  type?: ScrollAreaType;
  /** Fades the viewport's scrolled-away edges (ScrollShadow, CSS scroll-driven). @default false */
  shadow?: ScrollAreaShadow;
  /** Size of the `shadow` fade in px. @default 40 */
  shadowSize?: number;
}

const ScrollAreaRoot = (props: ScrollAreaRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "size", "variant", "type", "shadow", "shadowSize"]);
  const size = local.size ?? "md";
  const variant = local.variant ?? "hover";
  const type: ScrollAreaType = local.type ?? (variant === "always" ? "always" : "hover");
  const context: ScrollAreaContext = { shadow: local.shadow ?? false, shadowSize: local.shadowSize ?? 40 };
  const children = local.children;
  return (
    <ScrollAreaPrimitive
      {...(rest as ScrollAreaPrimitiveProps)}
      type={type}
      class={rootSlots(size, variant).base({ class: local.class })}
      data-slot="scroll-area"
    >
      <Provider token={ScrollAreaContext} value={context}>
        {children}
      </Provider>
    </ScrollAreaPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ScrollArea Viewport
 * -----------------------------------------------------------------------------------------------*/
interface ScrollAreaViewportProps extends Omit<ScrollAreaViewportPrimitiveProps, "class"> {
  class?: string;
}

const ScrollAreaViewport = (props: ScrollAreaViewportProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "style"]);
  const context = useContext(ScrollAreaContext);
  const shadow = context.shadow;
  const orientation = shadow === "horizontal" ? "horizontal" : "vertical";
  const cls = SLOTS.viewport({ class: shadow ? `${SHADOW_CLASS[orientation]}${local.class ? ` ${local.class}` : ""}` : local.class });
  const style = shadow ? { "--scroll-shadow-size": `${context.shadowSize ?? 40}px`, ...local.style } : local.style;
  return (
    <ScrollAreaViewportPrimitive
      {...(rest as ScrollAreaViewportPrimitiveProps)}
      class={cls}
      style={style}
      data-slot="scroll-area-viewport"
      data-scroll-shadow-mode={shadow ? "auto" : undefined}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * ScrollArea Scrollbar / Thumb / Corner
 * -----------------------------------------------------------------------------------------------*/
interface ScrollAreaScrollbarProps extends Omit<ScrollAreaScrollbarPrimitiveProps, "class"> {
  class?: string;
}

const ScrollAreaScrollbar = (props: ScrollAreaScrollbarProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const children = local.children;
  const cls = SLOTS.scrollbar({ class: local.class });
  return (
    <ScrollAreaScrollbarPrimitive {...(rest as ScrollAreaScrollbarPrimitiveProps)} class={cls} data-slot="scroll-area-scrollbar">
      {children ?? <ScrollAreaThumb />}
    </ScrollAreaScrollbarPrimitive>
  );
};

interface ScrollAreaThumbProps extends Omit<ScrollAreaThumbPrimitiveProps, "class"> {
  class?: string;
}

const ScrollAreaThumb = (props: ScrollAreaThumbProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <ScrollAreaThumbPrimitive {...(rest as ScrollAreaThumbPrimitiveProps)} class={SLOTS.thumb({ class: local.class })} data-slot="scroll-area-thumb" />;
};

interface ScrollAreaCornerProps extends Omit<ScrollAreaCornerPrimitiveProps, "class"> {
  class?: string;
}

const ScrollAreaCorner = (props: ScrollAreaCornerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return (
    <ScrollAreaCornerPrimitive {...(rest as ScrollAreaCornerPrimitiveProps)} class={SLOTS.corner({ class: local.class })} data-slot="scroll-area-corner" />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ScrollAreaContext, ScrollAreaCorner, ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport };

export type { ScrollAreaCornerProps, ScrollAreaRootProps, ScrollAreaScrollbarProps, ScrollAreaShadow, ScrollAreaThumbProps, ScrollAreaViewportProps };
