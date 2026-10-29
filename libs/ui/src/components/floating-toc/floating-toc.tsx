// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no floating TOC). Feature set inspired by commercial UI kits' public Floating
// TOC docs (a compact bar indicator per section that opens a floating list of sections on hover or press: root `placement`
// left / right, `triggerMode` hover / press, `open` / `defaultOpen` / `onOpenChange`, `openDelay` 200 / `closeDelay` 300;
// parts `.Trigger`, `.Bar` (`active`, `level`), `.Content` (popover, `offset` 8), `.Item` (`active`, `level`); classes
// `.floating-toc__*`, `--floating-toc-*` variables); independent implementation, Rivet-authored styles.
// - Root = cdk `DialogTrigger` (`trigger` = "hover" with `delay` / `closeDelay`, or "press"); `open` may be a two-way Signal.
//   Context `rv-ui-floating-toc` carries plain data (`placement`, `triggerMode`).
// - `.Trigger` = cdk `Button` (`.floating-toc__trigger`, `data-placement`) holding the bars; `.Bar` = `span` with
//   `data-active` and `--floating-toc-level`.
// - `.Content` = cdk `Popover`: placement derived from the root (`right` → "left", `left` → "right"), non-modal in hover mode.
// - `.Item` = cdk `Button` (`data-active`, `--floating-toc-level` indent); a press closes the content (both modes).
// - Which section is active is the app's state (e.g. an IntersectionObserver in the page): pass `active` to bars and items.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { DialogTrigger as DialogTriggerPrimitive, OverlayTriggerStateContext } from "@rivetjs/cdk/dialog";
import type { PressEvent } from "@rivetjs/cdk/interactions/press";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { closeOverlay } from "@rivetjs/cdk/state/overlays";
import type { OverlayTriggerState } from "@rivetjs/cdk/state/overlays";
import { createContext, useContext, type Signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { floatingTocVariants } from "../../../styles/src/components/floating-toc/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { portalTheme } from "../../utils/portal-theme.ts";

const SLOTS = floatingTocVariants();

interface FloatingTocContext {
  placement?: "left" | "right";
  triggerMode?: "hover" | "press";
}

const FloatingTocContext = createContext<FloatingTocContext>({});

/* -------------------------------------------------------------------------------------------------
 * FloatingToc Root
 * -----------------------------------------------------------------------------------------------*/
interface FloatingTocRootProps {
  /** Side of the page the TOC sits on. @default "right" */
  placement?: "left" | "right";
  /** What opens the content. @default "hover" */
  triggerMode?: "hover" | "press";
  /** Controlled open state (a value or a two-way Signal). */
  open?: boolean | Signal<boolean>;
  /** Initial open state. */
  defaultOpen?: boolean;
  /** Open state changed. */
  onOpenChange?: (open: boolean) => void;
  /** Hover mode: delay (ms) before opening. @default 200 */
  openDelay?: number;
  /** Hover mode: delay (ms) before closing once the pointer / focus left. @default 300 */
  closeDelay?: number;
  /** `.Trigger` and `.Content`. */
  children?: Content;
}

const FloatingTocRoot = (props: FloatingTocRootProps): JSX.Element => {
  const [local] = splitLive(props, ["children", "placement", "triggerMode", "open", "defaultOpen", "onOpenChange", "openDelay", "closeDelay"]);
  const placement = local.placement ?? "right";
  const triggerMode = local.triggerMode ?? "hover";
  const value: FloatingTocContext = { placement, triggerMode };
  const content = () => (
    <DialogTriggerPrimitive
      trigger={triggerMode}
      delay={local.openDelay ?? 200}
      closeDelay={local.closeDelay ?? 300}
      isOpen={local.open as never}
      defaultOpen={local.defaultOpen}
      onOpenChange={local.onOpenChange}
    >
      {local.children}
    </DialogTriggerPrimitive>
  );
  return (
    <Provider token={FloatingTocContext} value={value}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * FloatingToc Trigger
 * -----------------------------------------------------------------------------------------------*/
interface FloatingTocTriggerProps extends ButtonPrimitiveProps {
  children?: Content;
}

const FloatingTocTrigger = (props: FloatingTocTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  const context = useContext(FloatingTocContext);
  const cls = composeTwRenderProps(local.class as never, SLOTS.trigger()) as string | ((values: ButtonRenderProps) => string);
  return (
    <ButtonPrimitive
      aria-label="Table of contents"
      data-slot="floating-toc-trigger"
      data-placement={context.placement ?? "right"}
      {...(rest as object)}
      class={cls as never}
    >
      {local.children as never}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * FloatingToc Bar
 * -----------------------------------------------------------------------------------------------*/
interface FloatingTocBarProps extends Omit<JSX.IntrinsicElements["span"], "class" | "children"> {
  class?: string;
  /** The current section. */
  active?: boolean;
  /** Nesting depth (1 = top level); deeper bars are shorter. @default 1 */
  level?: number;
}

const FloatingTocBar = (props: FloatingTocBarProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "active", "level"]);
  return (
    <span
      aria-hidden="true"
      class={composeSlotClassName(SLOTS.bar, local.class)}
      data-slot="floating-toc-bar"
      data-active={local.active ? "true" : undefined}
      style={{ "--floating-toc-level": String(local.level ?? 1) }}
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * FloatingToc Content
 * -----------------------------------------------------------------------------------------------*/
interface FloatingTocContentProps extends Omit<PopoverPrimitiveProps, "children" | "isOpen" | "defaultOpen" | "onOpenChange" | "triggerRef"> {
  children?: Content;
}

const FloatingTocContent = (props: FloatingTocContentProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["class", "children", "offset", "placement"]);
  const context = useContext(FloatingTocContext);
  const cls = composeTwRenderProps(local.class as never, SLOTS.content()) as string | ((values: PopoverRenderProps) => string);
  const placement = local.placement ?? (context.placement === "left" ? "right top" : "left top");
  return (
    <PopoverPrimitive
      data-slot="floating-toc-content"
      isNonModal={context.triggerMode !== "press"}
      {...(rest as object)}
      class={cls as never}
      offset={local.offset ?? 8}
      placement={placement as never}
    >
      {local.children}
    </PopoverPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * FloatingToc Item
 * -----------------------------------------------------------------------------------------------*/
interface FloatingTocItemProps extends ButtonPrimitiveProps {
  /** The current section. */
  active?: boolean;
  /** Nesting depth (1 = top level); deeper items are indented. @default 1 */
  level?: number;
  children?: Content;
}

const FloatingTocItem = (props: FloatingTocItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "active", "level", "onPress"]);
  const state = useContext(OverlayTriggerStateContext) as OverlayTriggerState | null | undefined;
  const cls = composeTwRenderProps(local.class as never, SLOTS.item()) as string | ((values: ButtonRenderProps) => string);
  const handlers = {
    onPress: (e: PressEvent) => {
      local.onPress?.(e);
      // Both modes: in hover mode focus stays inside the list after a press, which would hold it open.
      if (state) closeOverlay(state);
    },
  };
  return (
    <ButtonPrimitive
      data-slot="floating-toc-item"
      data-active={local.active ? "true" : undefined}
      aria-current={local.active ? "location" : undefined}
      style={{ "--floating-toc-level": String(local.level ?? 1) }}
      {...(rest as object)}
      {...handlers}
      class={cls as never}
    >
      {local.children as never}
    </ButtonPrimitive>
  );
};

export { FloatingTocRoot, FloatingTocTrigger, FloatingTocBar, FloatingTocContent, FloatingTocItem };
export type { FloatingTocRootProps, FloatingTocTriggerProps, FloatingTocBarProps, FloatingTocContentProps, FloatingTocItemProps };
