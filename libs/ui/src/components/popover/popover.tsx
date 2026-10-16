// Ported from HeroUI v3.2.6 packages/react/src/components/popover/popover.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk` (`dialog` `DialogTrigger` / `Dialog`,
//   `heading`, `popover`, `overlay-arrow`, `interactions/pressable`); `@heroui/styles` → vendored `styles/`.
// - `PopoverContext` carries plain data `{ inPopover: true }` instead of the tv `slots` object (`popoverVariants` has no
//   variants, so the slots are one module-level object): resumable token `rv-ui-popover`, default `{}` → parts outside a
//   `Popover` get only the caller's `class` (= upstream `slots?.x`). `Popover.Content` does not re-provide it (upstream
//   re-provides the same value: a no-op).
// - `SurfaceContext` `{ variant: "default" }` is provided around the cdk `Popover` (its lazy children render inside it).
// - `Popover.Arrow`: upstream's default inline `<svg><path d=…/></svg>` → a CSS-shaped tip (`span`, `clip-path`, `background:
//   var(--overlay)`; icon rule: no hand-written SVG geometry) carrying the same `data-slot="popover-overlay-arrow"` (the vendored
//   rotate-per-placement rules apply). Custom children are not cloned (Rivet JSX has no element clone): give the child
//   `data-slot="popover-overlay-arrow"` yourself.
// - `Popover.Trigger`: cdk `Pressable` takes a render-function child (no clone): the `dom.div` spreads its press / focus props.
// - Live `class` → a render-prop function for the cdk part (the composed class is a local: it reaches the cdk part as a plain value); static `class` stays a string.
// - Rivet (identity spec §4.2, T19): `Popover.Content` = cdk Popover + `Popover.Dialog` (the Dialog carries no own choice in
//   the upstream demos); `title` renders a `Popover.Heading` first (the dialog's `aria-labelledby`); children may be a
//   function of the dialog render props (`{ close }`). `dialog={false}` = the upstream part (no Dialog: write your own
//   `Popover.Dialog` to style or label it). A `Popover.Dialog` inside a folded Content renders only its children (its
//   own props are not applied: the Content already made the dialog); the scope is a plain context created in the same
//   render as its readers (resume-safe).
import { Dialog as DialogPrimitive, DialogTrigger as PopoverTriggerPrimitive } from "@rivetjs/cdk/dialog";
import type { DialogProps as DialogPrimitiveProps, DialogTriggerProps } from "@rivetjs/cdk/dialog";
import { Heading as HeadingPrimitive } from "@rivetjs/cdk/heading";
import type { HeadingProps as HeadingPrimitiveProps } from "@rivetjs/cdk/heading";
import { Pressable as PressablePrimitive } from "@rivetjs/cdk/interactions/pressable";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import type { OverlayArrowProps } from "@rivetjs/cdk/overlay-arrow";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { renderSlot } from "@rivetjs/runtime/slot";
import type { DialogRenderProps } from "@rivetjs/cdk/dialog";

import type { PopoverVariants } from "../../../styles/src/components/popover/index.ts";
import { popoverVariants } from "../../../styles/src/components/popover/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { SurfaceContext } from "../surface/index.ts";

/* -------------------------------------------------------------------------------------------------
 * Popover Context
 * -----------------------------------------------------------------------------------------------*/
type PopoverContext = {
  /** Rivet: set by `Popover` (upstream: `slots`). */
  inPopover?: boolean;
};

const PopoverContext = resumableContext(createContext<PopoverContext>({}, { id: "rv-ui-popover" }));

type PopoverSlots = ReturnType<typeof popoverVariants>;
let SLOTS: PopoverSlots | undefined;
/** Upstream `use(PopoverContext).slots`: `popoverVariants()` inside a `Popover`, `undefined` outside. */
const slotsOf = (context: PopoverContext): PopoverSlots | undefined => (context.inPopover ? (SLOTS ??= popoverVariants()) : undefined);

const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };
const ROOT_CONTEXT: PopoverContext = { inPopover: true };
/** Rivet: the dialog render props of a folded `Popover.Content` (an explicit `Popover.Dialog` inside renders only its children). */
const FoldedDialogContext = createContext<DialogRenderProps | null>(null);

/* -------------------------------------------------------------------------------------------------
 * Popover Root
 * -----------------------------------------------------------------------------------------------*/
type PopoverRootProps = DialogTriggerProps;

const PopoverRoot = (props: PopoverRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children"]);
  // A function: Rivet JSX builds nodes eagerly, the trigger must be created inside the provider.
  const content = () => (
    <PopoverTriggerPrimitive data-slot="popover-root" {...rest}>
      {local.children}
    </PopoverTriggerPrimitive>
  );

  return (
    <Provider token={PopoverContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Popover Content
 * -----------------------------------------------------------------------------------------------*/
interface PopoverContentProps extends Omit<PopoverPrimitiveProps, "children">, PopoverVariants {
  /** Content; with the folded Dialog also a function of the dialog render props (`{ close }`). */
  children?: Content | ((opts: DialogRenderProps) => Content);
  /** Rivet: wrap the content in a `Popover.Dialog` (`false`: the cdk Popover only, write your own Dialog). @default true */
  dialog?: boolean;
  /** Rivet: a `Popover.Heading` before the content (labels the dialog). */
  title?: Content;
}

const PopoverContent = (props: PopoverContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "dialog", "title"]);
  const context = useContext(PopoverContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.base()) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const children = local.children;
  const title = local.title;
  const body = (renderProps: DialogRenderProps): Content => (
    <Provider token={FoldedDialogContext} value={renderProps}>
      {title !== undefined && <PopoverHeading>{title}</PopoverHeading>}
      {renderSlot(children, renderProps)}
    </Provider>
  );
  const folded = local.dialog !== false;
  // Built inside the cdk Popover (its overlay / dialog contexts); an own Dialog (`dialog={false}`) is never folded away.
  const inner = (): Content =>
    folded ? (
      <DialogPart>{body}</DialogPart>
    ) : (
      <Provider token={FoldedDialogContext} value={null}>
        {children as Content}
      </Provider>
    );
  const content = () => (
    <PopoverPrimitive {...rest} class={cls as never}>
      {inner()}
    </PopoverPrimitive>
  );

  return (
    <Provider token={SurfaceContext} value={DEFAULT_SURFACE_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Popover Arrow
 * -----------------------------------------------------------------------------------------------*/
type PopoverArrowProps = Omit<OverlayArrowProps, "children"> & {
  children?: Content;
};

/** The default tip: 12×12 box, triangle in the upper 8px (upstream svg viewBox), filled with the overlay colour. */
const ARROW_STYLE = {
  display: "block",
  width: "12px",
  height: "12px",
  background: "var(--overlay)",
  "clip-path": "polygon(0 0, 100% 0, 50% 66.667%)",
};

const PopoverArrow = (props: PopoverArrowProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const arrow = () => (local.children !== undefined ? local.children : <span aria-hidden="true" data-slot="popover-overlay-arrow" style={ARROW_STYLE} />);

  return (
    <OverlayArrow data-slot="popover-overlay-arrow-group" {...rest} class={local.class}>
      {arrow()}
    </OverlayArrow>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Popover Dialog
 * -----------------------------------------------------------------------------------------------*/
type PopoverDialogProps = Omit<DialogPrimitiveProps, "children" | "class"> & {
  children: DialogPrimitiveProps["children"];
  class?: string;
};

const PopoverDialog = (props: PopoverDialogProps): JSX.Element => {
  const folded = useContext(FoldedDialogContext);
  return folded ? (renderSlot(props.children, folded) as JSX.Element) : <DialogPart {...props} />;
};

const DialogPart = (props: PopoverDialogProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(PopoverContext);
  const classOf = () => composeSlotClassName(slotsOf(context)?.dialog, local.class) ?? "";
  const cls = hasLiveProp(local, ["class"]) ? () => classOf() : classOf();

  return (
    <DialogPrimitive data-slot="popover-dialog" {...rest} class={cls as never}>
      {local.children}
    </DialogPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Popover Trigger
 * -----------------------------------------------------------------------------------------------*/
interface PopoverTriggerProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `PopoverTrigger` props for the default element (`div`). */
type PopoverTriggerDivProps = PopoverTriggerProps & Omit<JSX.IntrinsicElements["div"], keyof PopoverTriggerProps>;

const PopoverTrigger = <E extends keyof JSX.IntrinsicElements = "div">(props: PopoverTriggerProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as PopoverTriggerDivProps, ["children", "class"]);
  const context = useContext(PopoverContext);

  return (
    <PressablePrimitive>
      {(pressProps: Record<string, unknown>) => (
        <dom.div
          class={composeSlotClassName(slotsOf(context)?.trigger, local.class)}
          data-slot="popover-trigger"
          role="button"
          {...pressProps}
          {...rest}
          ref={pressProps.ref as never}
        >
          {local.children}
        </dom.div>
      )}
    </PressablePrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Popover Heading
 * -----------------------------------------------------------------------------------------------*/
type PopoverHeadingProps = HeadingPrimitiveProps & {};

const PopoverHeading = (props: PopoverHeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(PopoverContext);

  return (
    <HeadingPrimitive slot="title" {...rest} class={composeSlotClassName(slotsOf(context)?.heading, local.class)}>
      {local.children}
    </HeadingPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { PopoverRoot, PopoverTrigger, PopoverDialog, PopoverArrow, PopoverContent, PopoverHeading };

export type { PopoverRootProps, PopoverTriggerProps, PopoverTriggerDivProps, PopoverDialogProps, PopoverArrowProps, PopoverContentProps, PopoverHeadingProps };
