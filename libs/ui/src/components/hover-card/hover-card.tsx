// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no hover card). Feature set inspired by HeroUI Pro's public Hover Card
// docs (a preview card on hover / keyboard focus / touch long press; `openDelay` 700 / `closeDelay` 300; parts `.Trigger`,
// `.Content` (placement top, offset 8), `.Arrow`); independent implementation, Rivet-authored styles on HeroUI tokens.
// - Root = cdk `PreviewTrigger` (RAC PreviewTrigger: shared warmup with tooltips, safe area between trigger and card, Escape
//   closes, Tab moves into the card; `isOpen` value or two-way Signal / `defaultOpen` / `onOpenChange` / `isDisabled`).
// - `.Trigger` = an inline `span` that takes the trigger props from the cdk `FocusableContext` (`focusableProps`), focusable by
//   default (`tabIndex` 0, `role="button"`: the trigger carries `aria-expanded` / `aria-haspopup`) so keyboard focus opens the card; `render` swaps the element (the `dom.span` contract).
// - `.Content` = cdk `Popover` (div overlay layer, non-modal, `role="dialog"`: name it with `aria-label`); `.Arrow` = cdk
//   `OverlayArrow` with a CSS-shaped tip (icon rule: no hand-written SVG geometry), rotated per placement.
// - Nothing runs before input: the cdk trigger installs its listeners at the first pointerenter / focus.
import { focusableProps } from "@rivetjs/cdk/focusable";
import { mergeProps } from "@rivetjs/cdk/interactions/merge-props";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import type { OverlayArrowProps } from "@rivetjs/cdk/overlay-arrow";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { PreviewTrigger } from "@rivetjs/cdk/preview-trigger";
import type { PreviewTriggerProps } from "@rivetjs/cdk/preview-trigger";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { hoverCardVariants } from "../../../styles/src/components/hover-card/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { portalTheme } from "../../utils/portal-theme.ts";

const SLOTS = hoverCardVariants();

/* -------------------------------------------------------------------------------------------------
 * HoverCard Root
 * -----------------------------------------------------------------------------------------------*/
interface HoverCardRootProps extends Omit<PreviewTriggerProps, "delay"> {
  /** Time (ms) before the card opens after hover. @default 700 */
  openDelay?: number;
  /** Time (ms) before the card closes after the pointer / focus leaves. @default 300 */
  closeDelay?: number;
  /** The `HoverCard.Trigger` and its `HoverCard.Content`. */
  children?: Content;
}

const HoverCardRoot = (props: HoverCardRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "closeDelay", "openDelay"]);
  return (
    <PreviewTrigger {...rest} delay={local.openDelay ?? 700} closeDelay={local.closeDelay ?? 300}>
      {local.children}
    </PreviewTrigger>
  );
};

/* -------------------------------------------------------------------------------------------------
 * HoverCard Trigger
 * -----------------------------------------------------------------------------------------------*/
interface HoverCardTriggerProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `HoverCard.Trigger` props for the default element (`span`). */
type HoverCardTriggerSpanProps = HoverCardTriggerProps & Omit<JSX.IntrinsicElements["span"], keyof HoverCardTriggerProps>;

const HoverCardTrigger = <E extends keyof JSX.IntrinsicElements = "span">(props: HoverCardTriggerProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as HoverCardTriggerSpanProps, ["children", "class"]);
  // The cdk PreviewTrigger's FocusableContext (trigger handlers, ARIA accessors, triggerRef) — `focusableProps` rather than the
  // `<Focusable>` wrapper (see `tooltip.tsx`: its dev check warns falsely inside inert subtrees).
  const merged = mergeProps({ tabIndex: 0 }, focusableProps({}), rest as Record<string, unknown>);
  const cls = () => composeSlotClassName(SLOTS.trigger, local.class);

  if (merged.render)
    return (
      <dom.span class={cls()} data-slot="hover-card-trigger" role="button" {...merged}>
        {local.children}
      </dom.span>
    );

  // A plain element with an explicit `ref` (a `ref` inside a `dom.*` spread is not resumed: the trigger ref positions the card).
  return (
    <span class={cls()} data-slot="hover-card-trigger" role="button" {...(merged as JSX.IntrinsicElements["span"])} ref={merged.ref as never}>
      {local.children}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * HoverCard Content
 * -----------------------------------------------------------------------------------------------*/
interface HoverCardContentProps extends Omit<PopoverPrimitiveProps, "children" | "isOpen" | "defaultOpen" | "onOpenChange" | "triggerRef"> {
  children?: Content;
}

const HoverCardContent = (props: HoverCardContentProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "offset", "placement"]);
  const classOf = () => composeTwRenderProps(local.class as never, SLOTS.content()) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  return (
    <PopoverPrimitive data-slot="hover-card-content" {...rest} class={cls as never} offset={local.offset ?? 8} placement={local.placement ?? "top"}>
      {local.children}
    </PopoverPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * HoverCard Arrow
 * -----------------------------------------------------------------------------------------------*/
type HoverCardArrowProps = Omit<OverlayArrowProps, "children" | "class"> & {
  children?: Content;
  class?: string;
};

/** The default tip: 12×12 box, triangle in the upper 8px, filled with the overlay colour. */
const ARROW_STYLE = {
  display: "block",
  width: "12px",
  height: "12px",
  background: "var(--overlay)",
  "clip-path": "polygon(0 0, 100% 0, 50% 66.667%)",
};

const HoverCardArrow = (props: HoverCardArrowProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const arrow = () => (local.children !== undefined ? local.children : <span aria-hidden="true" data-slot="hover-card-arrow-tip" style={ARROW_STYLE} />);
  return (
    <OverlayArrow data-slot="hover-card-arrow" {...rest} class={composeSlotClassName(SLOTS.arrow, local.class)}>
      {arrow()}
    </OverlayArrow>
  );
};

export { HoverCardRoot, HoverCardTrigger, HoverCardContent, HoverCardArrow };
export type { HoverCardRootProps, HoverCardTriggerProps, HoverCardTriggerSpanProps, HoverCardContentProps, HoverCardArrowProps };
