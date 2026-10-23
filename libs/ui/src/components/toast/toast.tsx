// Ported from HeroUI v3.2.6 packages/react/src/components/toast/toast.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/Toast` → `@rivetjs/cdk/toast` (`UNSTABLE_ToastRegion` /
//   `UNSTABLE_Toast` / `UNSTABLE_ToastContent` / `UNSTABLE_ToastStateContext`), `Text` → `@rivetjs/cdk/text`; `@heroui/styles` →
//   vendored `styles/`; `useFocusVisible` → cdk `isFocusVisible()` (read when focus has to move).
// - The region exists only while toasts are visible and is created in the browser (cdk: the server renders an empty anchor, a
//   resumed page wakes it with the first toast). Everything upstream keeps in `ToastProvider` state (exiting keys, heights,
//   hover / focus expansion, `useMediaQuery`, the region listeners, timer suspension) lives in `ToastRegionHost`, the element the
//   cdk region's `render` prop renders: created with the region, disposed with it. `ToastProvider` itself only passes plain
//   options (read once) to that `render` arrow, so a server-rendered provider costs no client code before the first toast.
// - `ToastContext` carries signals / accessors (`exitingKeys()`, `heightsByKey()`, `isExpanded()`, `isMobile()`) instead of
//   React snapshots, plus `inToast` instead of the tv `slots` (slots = `toastVariants({ placement })` memoized per placement).
// - React re-renders the default toast when `update()` mutates its content; here the default renderer reads the content through
//   the region's `visibleToasts()` signal (the queue notifies on update), so title / description / indicator / action / variant
//   follow in place. A custom `children` renderer runs once per toast (read `toast.content` in function children / accessors to
//   follow updates).
// - `Toast` element: the cdk `Toast` `render` prop renders the `div` with an explicit `ref` (upstream `mergeRefs`; the cdk part
//   takes no `ref`) and the reactive `data-*` state; tab index / `aria-hidden` / `inert` are set imperatively from an effect, as
//   upstream's layout effect.
// - `ToastIndicator` `data-swapped`: Rivet children are slots (static); a function child is re-evaluated and its result's kind
//   (element `data-slot` / tag, text, nothing) is compared, as upstream compares `children.type` across renders.
// - Default icons: upstream's inline `InfoIcon` / `SuccessIcon` / `WarningIcon` / `DangerIcon` svgs → lucide `Info` /
//   `CircleCheck` / `TriangleAlert` / `CircleAlert` via `@rivetjs/kit/icon` (as `Alert`), same `data-slot="toast-default-icon"`.
// - `children ?? default` (indicator): React `{undefined}` children fall back; a Rivet child expression is always a slot, so the
//   default renderer omits the children when there is no custom indicator.
import { getOwnerDocument, getOwnerWindow } from "@rivetjs/cdk/dom";
import { isFocusVisible } from "@rivetjs/cdk/interactions/focus-visible";
import type { QueuedToast, ToastState } from "@rivetjs/cdk/state/toast";
import { Text as TextPrimitive } from "@rivetjs/cdk/text";
import type { TextProps as TextPrimitiveProps } from "@rivetjs/cdk/text";
import {
  UNSTABLE_ToastContent as ToastContentPrimitive,
  UNSTABLE_Toast as ToastPrimitive,
  UNSTABLE_ToastRegion as ToastRegionPrimitive,
  UNSTABLE_ToastStateContext as ToastStateContext,
} from "@rivetjs/cdk/toast";
import type {
  ToastContentProps as ToastContentPrimitiveProps,
  ToastProps as ToastPrimitiveProps,
  ToastRegionProps as ToastRegionPrimitiveProps,
  ToastRegionRenderProps,
  ToastRenderProps,
} from "@rivetjs/cdk/toast";
import { Icon } from "@rivetjs/kit/icon";
import { computed, createContext, effect, onCleanup, signal, untrack, useContext } from "@rivetjs/reactivity";
import { Provider, Show, ref as createRef } from "@rivetjs/runtime/dom";
import type { Ref } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide";

import type { ToastVariants } from "../../../styles/src/components/toast/index.ts";
import { toastVariants } from "../../../styles/src/components/toast/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { Button } from "../button/index.ts";
import type { ButtonRootProps } from "../button/index.ts";
import { CloseButton } from "../close-button/index.ts";
import type { CloseButtonRootProps } from "../close-button/index.ts";
import { Spinner } from "../spinner/index.ts";

import { DEFAULT_GAP, DEFAULT_HOTKEY, DEFAULT_MAX_VISIBLE_TOAST, DEFAULT_SCALE_FACTOR, DEFAULT_TOAST_WIDTH } from "./constants.ts";
import { exitAwareQueueOf, toastQueue as defaultToastQueue } from "./toast-queue.ts";
import type { StatelyToastQueue, ToastContentValue, ToastQueue } from "./toast-queue.ts";
import { portalTheme } from "../../utils/portal-theme.ts";

type ToastPlacement = NonNullable<ToastVariants["placement"]>;
type CSSVars = Record<string, string | number | undefined>;

/* ------------------------------------------------------------------------------------------------
 * Toast Context
 * --------------------------------------------------------------------------------------------- */
type ToastContext = {
  /** Rivet: set inside a `Toast.Provider` region (upstream: `slots`). */
  inToast?: boolean;
  placement?: ToastVariants["placement"];
  scaleFactor?: number;
  gap?: number;
  maxVisibleToasts?: number;
  heightsByKey?: () => Record<string, number>;
  // Keys of toasts currently playing their exit animation.
  exitingKeys?: () => ReadonlySet<string>;
  isExpanded?: () => boolean;
  /** Rivet: upstream's provider-level `useMediaQuery("(max-width: 768px)")`. */
  isMobile?: () => boolean;
  onToastHeightChange?: (key: string, height: number) => void;
  onToastHeightRemove?: (key: string) => void;
};

const ToastContext = createContext<ToastContext>({});

type ToastSlots = ReturnType<typeof toastVariants>;
const SLOTS = new Map<string, ToastSlots>();
const slotsFor = (placement: ToastVariants["placement"]): ToastSlots => {
  const key = String(placement);
  let slots = SLOTS.get(key);
  if (!slots) SLOTS.set(key, (slots = toastVariants({ placement })));
  return slots;
};
/** Upstream `use(ToastContext).slots`: the provider placement's slots inside a region, `undefined` outside. */
const slotsOf = (context: ToastContext): ToastSlots | undefined => (context.inToast ? slotsFor(context.placement) : undefined);

// The KeyboardEvent boolean props a hotkey entry can name; anything else is an event.code.
const MODIFIER_PROPS = ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const;

const EMPTY_EXITING_KEYS: ReadonlySet<string> = new Set();

/** A `ref()` signal or a callback ref. */
const setRef = <E,>(target: unknown, el: E): void => {
  if (typeof target !== "function") return;
  const set = (target as { set?: (v: E) => void }).set;
  if (typeof set === "function") set.call(target, el);
  else (target as (v: E) => void)(el);
};

const dataAttr = (condition: boolean | undefined): "true" | undefined => (condition ? "true" : undefined);

// Mirrors React Aria's focus handling when a focused toast is removed:
// pointer focus leaves the region (so hover collapse and timers stay live), keyboard focus moves to the nearest remaining toast, newer first.
const moveFocusFromToast = (toastEl: HTMLElement, isKeyboardFocus: boolean) => {
  const doc = toastEl.ownerDocument;

  if (!isKeyboardFocus) {
    (doc.activeElement as HTMLElement | null)?.blur();

    return;
  }

  const isViable = (el: Element | null): el is HTMLElement =>
    el instanceof HTMLElement && el.matches('[data-slot="toast"]:not([data-exiting="true"]):not([data-hidden="true"])');

  // Rivet: each toast sits in its own `li` (RAC ToastList); siblings are the neighbouring items' toasts.
  const toastOf = (item: Element | null): Element | null => (item && item !== toastEl.parentElement ? (item.firstElementChild ?? item) : item);
  const item = toastEl.parentElement?.tagName === "LI" ? toastEl.parentElement : toastEl;

  // Prefer nearest newer toast (previous siblings, DOM order is newest-first).
  let target: HTMLElement | null = null;
  let sibling = item.previousElementSibling;

  while (sibling) {
    const candidate = toastOf(sibling);
    if (isViable(candidate)) {
      target = candidate;
      break;
    }
    sibling = sibling.previousElementSibling;
  }

  // Fallback to nearest older toast.
  if (!target) {
    sibling = item.nextElementSibling;
    while (sibling) {
      const candidate = toastOf(sibling);
      if (isViable(candidate)) {
        target = candidate;
        break;
      }
      sibling = sibling.nextElementSibling;
    }
  }

  // Rare fallback: non-sibling structure or portal-like rendering.
  if (!target) {
    const region = toastEl.closest<HTMLElement>('[data-slot="toast-region"]');

    if (region) {
      for (const candidate of region.querySelectorAll<HTMLElement>('[data-slot="toast"]:not([data-exiting="true"]):not([data-hidden="true"])')) {
        if (candidate !== toastEl) {
          target = candidate;
          break;
        }
      }
    }
  }

  if (target) {
    target.focus();
  } else {
    (doc.activeElement as HTMLElement | null)?.blur();
  }
};

/** Rivet: upstream `useMeasuredHeight` (scroll height with `height: auto`, re-measured on DOM mutations and inline-size changes). */
const measuredHeight = (element: () => HTMLElement | undefined) => {
  const height = signal<number | undefined>(undefined);
  effect(() => {
    const el = element();
    if (!el) return;
    const calculateHeight = () => {
      const previousHeight = el.style.height;
      el.style.height = "auto";
      const measured = el.scrollHeight;
      el.style.height = previousHeight;
      if (untrack(height) !== measured) height.set(measured);
    };
    const view = el.ownerDocument.defaultView;
    // Upstream measures in a layout effect (after the node is inserted). A toast added to a live region gets its ref before
    // the list inserts it (scrollHeight 0): measure once the same-tick insertion is done.
    let disposed = false;
    if (el.isConnected) calculateHeight();
    else queueMicrotask(() => !disposed && calculateHeight());
    if (!view) return;
    let measureFrame = 0;
    const scheduleMeasure = () => {
      if (measureFrame) return;
      measureFrame = view.requestAnimationFrame(() => {
        measureFrame = 0;
        calculateHeight();
      });
    };
    const mutationObserver = new view.MutationObserver(scheduleMeasure);
    mutationObserver.observe(el, { attributeFilter: ["class"], attributes: true, characterData: true, childList: true, subtree: true });
    // Content reflowing at a new width changes the measured height without touching the DOM. Only the inline axis is watched.
    let lastWidth = el.getBoundingClientRect().width;
    const resizeObserver =
      typeof view.ResizeObserver === "function"
        ? new view.ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width;
            if (width === undefined || Math.abs(width - lastWidth) < 0.5) return;
            lastWidth = width;
            scheduleMeasure();
          })
        : null;
    resizeObserver?.observe(el);
    onCleanup(() => {
      disposed = true;
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      view.cancelAnimationFrame(measureFrame);
    });
  });
  return height;
};

/* ------------------------------------------------------------------------------------------------
 * Toast
 * --------------------------------------------------------------------------------------------- */
interface ToastProps<T extends object = ToastContentValue> extends ToastPrimitiveProps<T>, ToastVariants {
  /**
   * How much each toast behind the front one scales down.
   * Inherited from the provider when omitted.
   * @default 0.05
   */
  scaleFactor?: number;
  ref?: Ref<HTMLDivElement> | ((el: HTMLDivElement) => void);
}

const Toast = <T extends object = ToastContentValue>(props: ToastProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "placement", "ref", "render", "scaleFactor", "style", "toast", "variant"]);
  const context = useContext(ToastContext);
  const gap = context.gap ?? DEFAULT_GAP;
  const maxVisibleToasts = context.maxVisibleToasts ?? DEFAULT_MAX_VISIBLE_TOAST;
  const finalPlacement = local.placement ?? context.placement;
  const finalScaleFactor = local.scaleFactor ?? context.scaleFactor ?? DEFAULT_SCALE_FACTOR;

  const state = useContext(ToastStateContext) as ToastState<T>;
  const toast = local.toast;
  const toastKey = toast?.key;
  const isExiting = () => toastKey != null && (context.exitingKeys?.().has(toastKey) ?? false);
  const isExpanded = () => context.isExpanded?.() ?? false;

  // Exiting toasts are excluded from layout (siblings reposition during the exit animation) but keep their own slot while fading out.
  const layoutToasts = computed(() => {
    const visibleToasts = state.visibleToasts();
    const exitingKeys = context.exitingKeys?.();
    if (!exitingKeys || exitingKeys.size === 0) {
      return visibleToasts;
    }

    return visibleToasts.filter((t) => !exitingKeys.has(t.key) || t.key === toastKey);
  });

  const fullIndex = () => state.visibleToasts().indexOf(toast);
  const index = () => layoutToasts().indexOf(toast);
  const isFrontmost = () => index() <= 0;
  const isHidden = () => !isExiting() && index() >= maxVisibleToasts;
  const toastRef = createRef<HTMLDivElement>();
  const toastHeight = measuredHeight(toastRef);
  const isEntering = signal(true);

  if (typeof requestAnimationFrame === "function") {
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        isEntering.set(false);
      });
    });

    onCleanup(() => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    });
  }

  // Siblings get this height as soon as it is measured.
  effect(() => {
    const height = toastHeight();
    if (toastKey && typeof height === "number") {
      untrack(() => context.onToastHeightChange?.(toastKey, height));
    }
  });

  if (toastKey) {
    onCleanup(() => {
      context.onToastHeightRemove?.(toastKey);
    });
  }

  // react-aria-components filters tabIndex and aria-hidden out of Toast props, so set both imperatively.
  effect(() => {
    const el = toastRef();

    if (!el) {
      return;
    }

    const frontmost = isFrontmost();
    const expanded = isExpanded();
    const hidden = isHidden();
    const exiting = isExiting();

    untrack(() => {
      el.tabIndex = frontmost || (expanded && !hidden && !exiting) ? 0 : -1;

      if (hidden || exiting) {
        // Browsers block aria-hidden around a focused element, so focus must move out first.
        if (el.contains(el.ownerDocument.activeElement)) {
          moveFocusFromToast(el, isFocusVisible());
        }

        el.setAttribute("aria-hidden", "true");

        if (exiting) {
          // Exiting is one-way: drop the dying controls from the tab order.
          // inert would also stop pointer events, which must keep hitting the ghost so the stack stays expanded under a resting cursor.
          for (const control of el.querySelectorAll<HTMLElement>("button, a")) {
            control.tabIndex = -1;
          }
        } else {
          // Hidden toasts can become visible again; inert is reversible and they are pointer-events: none already.
          el.setAttribute("inert", "");
        }
      } else {
        el.removeAttribute("aria-hidden");
        el.removeAttribute("inert");
      }
    });
  });

  const stackingStyle = computed<CSSVars>(() => {
    const toasts = layoutToasts();
    const heightsByKey = context.heightsByKey?.();
    const height = toastHeight();
    const i = index();
    const frontToastKey = toasts[0]?.key;

    const frontHeight = (frontToastKey ? heightsByKey?.[frontToastKey] : undefined) ?? height ?? 0;

    let heightsBefore = 0;

    for (let n = 0; n < i; n++) {
      const key = toasts[n]?.key;

      heightsBefore += (key ? heightsByKey?.[key] : undefined) ?? frontHeight;
    }

    // Deliberately unnamed for view transitions: stacking is animated with CSS transitions.
    return {
      "--offset-collapsed": `${i * gap}px`,
      "--offset-expanded": `${heightsBefore + i * gap}px`,
      "--scale-collapsed": `${1 - i * finalScaleFactor}`,
      "z-index": isExiting() ? 0 : state.visibleToasts().length - fullIndex(),

      // frontHeight always resolves to a number, so this is unconditional.
      "--front-height": `${frontHeight}px`,

      ...(typeof height === "number" ? { "--toast-height": `${height}px` } : null),
    };
  });

  const userStyle = local.style;
  const toastStyle = (values: ToastRenderProps<T>): CSSVars => ({
    ...stackingStyle(),
    ...((typeof userStyle === "function" ? (userStyle as (v: ToastRenderProps<T>) => CSSVars)(values) : userStyle) as CSSVars | undefined),
  });

  const classOf = () =>
    composeTwRenderProps(local.class as never, slotsOf(context)?.toast({ variant: local.variant })) as string | ((v: ToastRenderProps<T>) => string);
  const cls = (values: ToastRenderProps<T>) => renderClass(classOf(), values);
  const userRef = local.ref;
  const userRender = local.render;
  const bindRef = (el: HTMLDivElement) => {
    (toastRef as unknown as { set: (v: HTMLDivElement) => void }).set(el);
    setRef(userRef, el);
  };

  return (
    <ToastPrimitive
      {...(rest as object)}
      class={cls as never}
      style={toastStyle as never}
      toast={toast}
      render={(attrs, renderProps) => {
        const element = {
          ...(attrs as object),
          ref: bindRef,
          "data-entering": () => dataAttr(isEntering()),
          "data-exiting": () => dataAttr(isExiting()),
          "data-expanded": () => dataAttr(isExpanded()),
          "data-frontmost": () => dataAttr(isFrontmost()),
          "data-hidden": () => dataAttr(isHidden()),
          "data-index": () => index(),
          "data-placement": finalPlacement,
          "data-slot": "toast",
        };
        return userRender ? (userRender as (a: object, r: unknown) => JSX.Element)(element, renderProps) : <div {...(element as {})} />;
      }}
    >
      {local.children}
    </ToastPrimitive>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Toast Content
 * --------------------------------------------------------------------------------------------- */
interface ToastContentProps extends ToastContentPrimitiveProps {}

const ToastContent = (props: ToastContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ToastContext);

  return (
    <ToastContentPrimitive {...rest} class={composeSlotClassName(slotsOf(context)?.content, local.class)} data-slot="toast-content">
      {local.children}
    </ToastContentPrimitive>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Toast Indicator
 * --------------------------------------------------------------------------------------------- */
interface ToastIndicatorProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  /** Rivet: a function child is re-evaluated (and marks `data-swapped` when the kind of its result changes). */
  children?: Content | (() => Content);
  class?: string;
  variant?: ToastVariants["variant"];
}

/** Kind of an indicator child for the swap marker (upstream: `children.type`, else the value or `"default"`). */
const kindOf = (value: unknown): unknown => {
  if (value == null || value === false) return "default";
  if (typeof Node !== "undefined" && value instanceof Node) {
    return value instanceof Element ? (value.getAttribute("data-slot") ?? value.tagName) : value.nodeName;
  }
  return value;
};

const ToastIndicator = <E extends keyof JSX.IntrinsicElements = "div">(props: ToastIndicatorProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ToastIndicatorProps, ["children", "class", "variant"]);
  const context = useContext(ToastContext);
  const children = local.children;
  const childFn = typeof children === "function" && !isSlot(children) ? (children as () => Content) : null;

  // The swap marker lets CSS animate content that replaces earlier content (a promise toast settling) without animating the first paint.
  const hasSwapped = signal(false);
  const UNSET = {};
  let previousKind: unknown = UNSET;
  const evaluate = (): unknown => {
    const value = childFn!();
    const kind = kindOf(value);
    if (previousKind !== UNSET && previousKind !== kind) untrack(() => hasSwapped.set(true));
    previousKind = kind;
    return value;
  };

  const getDefaultIcon = () => {
    switch (local.variant) {
      case "accent":
        return <Icon icon={Info} data-slot="toast-default-icon" />;
      case "success":
        return <Icon icon={CircleCheck} data-slot="toast-default-icon" />;
      case "warning":
        return <Icon icon={TriangleAlert} data-slot="toast-default-icon" />;
      case "danger":
        return <Icon icon={CircleAlert} data-slot="toast-default-icon" />;
      default:
        return <Icon icon={Info} data-slot="toast-default-icon" />;
    }
  };

  return (
    <dom.div
      {...(rest as object)}
      class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
      data-slot="toast-indicator"
      data-swapped={dataAttr(hasSwapped())}
    >
      {childFn ? () => (evaluate() as Content) ?? getDefaultIcon() : children === undefined ? () => getDefaultIcon() : (children as Content)}
    </dom.div>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Toast Title
 * --------------------------------------------------------------------------------------------- */
interface ToastTitleProps extends TextPrimitiveProps {}

const ToastTitle = (props: ToastTitleProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ToastContext);

  return (
    <TextPrimitive {...rest} class={composeSlotClassName(slotsOf(context)?.title, local.class)} data-slot="toast-title" slot="title">
      {local.children}
    </TextPrimitive>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Toast Description
 * --------------------------------------------------------------------------------------------- */
interface ToastDescriptionProps extends TextPrimitiveProps {}

const ToastDescription = (props: ToastDescriptionProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ToastContext);

  return (
    <TextPrimitive {...rest} class={composeSlotClassName(slotsOf(context)?.description, local.class)} data-slot="toast-description" slot="description">
      {local.children}
    </TextPrimitive>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Toast Close Button
 * --------------------------------------------------------------------------------------------- */
interface ToastCloseButtonProps extends CloseButtonRootProps {}

const ToastCloseButton = (props: ToastCloseButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(ToastContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.close()) as string | ((v: never) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();

  return <CloseButton {...rest} class={cls as never} data-slot="toast-close" slot="close" />;
};

/* ------------------------------------------------------------------------------------------------
 * Toast Action Button
 * --------------------------------------------------------------------------------------------- */
interface ToastActionButtonProps extends ButtonRootProps {}

const ToastActionButton = (props: ToastActionButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ToastContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.action?.()) as string | ((v: never) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();

  return (
    <Button {...rest} class={cls as never} data-slot="toast-action-button">
      {local.children}
    </Button>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Default toast (upstream `getDefaultChildren`)
 * --------------------------------------------------------------------------------------------- */
const DefaultToast = (props: { toast: QueuedToast<ToastContentValue>; placement: ToastPlacement; scaleFactor: number }): JSX.Element => {
  const toast = props.toast;
  const state = useContext(ToastStateContext) as ToastState<ToastContentValue>;
  const context = useContext(ToastContext);
  // Rivet: `update()` mutates the content and notifies the queue; reading `visibleToasts()` re-reads it.
  const content = (): ToastContentValue => {
    state.visibleToasts();
    return (toast.content as ToastContentValue | undefined) ?? {};
  };
  const variant = computed(() => content().variant);
  const indicator = computed(() => content().indicator);
  const isLoading = computed(() => content().isLoading ?? false);
  const title = computed(() => content().title);
  const description = computed(() => content().description);
  const actionProps = computed(() => content().actionProps);
  const isMobile = () => context.isMobile?.() ?? false;
  const action = () => {
    const p = actionProps();
    return p?.children ? <ToastActionButton {...p}>{p.children}</ToastActionButton> : null;
  };

  return (
    <Toast placement={props.placement} scaleFactor={props.scaleFactor} toast={toast} variant={variant()}>
      <Show when={() => indicator() !== null}>
        {() => <ToastIndicator variant={variant()}>{() => (isLoading() ? <Spinner color="current" size="sm" /> : (indicator() as Content))}</ToastIndicator>}
      </Show>
      <ToastContent>
        <Show when={() => !!title()}>{() => <ToastTitle>{() => title() as Content}</ToastTitle>}</Show>
        <Show when={() => !!description()}>{() => <ToastDescription>{() => description() as Content}</ToastDescription>}</Show>
        <Show when={() => isMobile() && !!actionProps()?.children}>{() => action()}</Show>
      </ToastContent>
      <Show when={() => !isMobile() && !!actionProps()?.children}>{() => action()}</Show>
      <ToastCloseButton />
    </Toast>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Toast Region
 * --------------------------------------------------------------------------------------------- */
type ToastRenderFunctionProps<T extends object> = { toast: QueuedToast<T>; isLoading: boolean };

interface ToastProviderProps<T extends object = ToastContentValue> extends Omit<
  ToastRegionPrimitiveProps<T>,
  "queue" | "children" | "render" | "class" | "style"
> {
  // Custom render function or element replacing the default toast layout.
  children?: Content | ((renderProps: ToastRenderFunctionProps<T>) => Content);
  class?: string | ((values: ToastRegionRenderProps<T>) => string);
  style?: CSSVars | ((values: ToastRegionRenderProps<T>) => CSSVars);
  ref?: Ref<HTMLElement> | ((el: HTMLElement) => void);
  /**
   * The gap between toasts in pixels.
   * @default 12
   */
  gap?: number;
  /**
   * Keeps the stack in its expanded layout instead of expanding only on
   * hover or keyboard focus. Forced expansion does not pause toast timers.
   * @default false
   */
  isExpanded?: boolean;
  /**
   * The maximum number of toasts to display at a time (visual only).
   * @default 3
   */
  maxVisibleToasts?: number;
  /**
   * Hotkey that focuses the toast region. Modifiers match KeyboardEvent boolean props, other keys match event.code. Modifiers left out must be up, so Alt+T does not fire on Ctrl+Alt+T. Pass [] to disable.
   * @default ["altKey", "KeyT"]
   */
  hotkey?: string[];
  /**
   * How much each toast behind the front one scales down.
   * @default 0.05
   */
  scaleFactor?: number;
  /**
   * Placement of the toast region.
   * @default "bottom"
   */
  placement?: ToastVariants["placement"];
  // Custom toast queue instance; defaults to the shared toastQueue.
  queue?: ToastQueue<T>;
  /**
   * The width of the toast; numbers are pixels.
   * @default 460
   */
  width?: number | string;
}

/** Plain options the provider hands the region host (read once; captured by the region's resumable `render` arrow). */
interface RegionOptions {
  class: ToastProviderProps["class"];
  style: ToastProviderProps["style"];
  ref: ToastProviderProps["ref"];
  gap: number;
  hotkey: string[];
  isExpanded: boolean;
  maxVisibleToasts: number;
  placement: ToastPlacement;
  scaleFactor: number;
  width: number | string;
}

/** The region element + upstream `ToastProvider` state; created with the cdk region (first visible toast), disposed with it. */
const ToastRegionHost = <T extends object>(props: {
  attrs: Record<string, unknown>;
  renderProps: ToastRegionRenderProps<T>;
  options: RegionOptions;
}): JSX.Element => {
  const { attrs, renderProps, options } = props;
  const state = useContext(ToastStateContext) as ToastState<T>;
  const exitAwareQueue = exitAwareQueueOf<T>(untrack(state.visibleToasts));
  const slots = slotsFor(options.placement);

  // Toasts still mounted but playing their exit animation. A foreign react-stately queue degrades gracefully to instant removal.
  const exitingKeys = signal<ReadonlySet<string>>(exitAwareQueue ? exitAwareQueue.getExitingKeys() : EMPTY_EXITING_KEYS);
  if (exitAwareQueue) {
    onCleanup(exitAwareQueue.subscribeExiting(() => exitingKeys.set(exitAwareQueue.getExitingKeys())));
  }

  // Upstream `useMediaQuery("(max-width: 768px)")`.
  // The region host only renders in the browser (cdk ToastRegion: server = empty anchor); cdk `getOwnerWindow` keeps the
  // compiler's server-global check (RV2001) satisfied (`undefined` on the server).
  const view = getOwnerWindow() as Window | undefined;
  const mobileQuery = view?.matchMedia?.("(max-width: 768px)");
  const isMobile = signal(mobileQuery?.matches ?? false);
  if (mobileQuery) {
    const onChange = () => isMobile.set(mobileQuery.matches);
    mobileQuery.addEventListener?.("change", onChange);
    onCleanup(() => mobileQuery.removeEventListener?.("change", onChange));
  }

  const toastHeights = signal<Record<string, number>>({});
  const isPointerOrFocusWithin = signal(false);
  let pointerWithin = false;

  const regionRef = attrs.ref as Ref<HTMLDivElement> | undefined;
  const userRef = options.ref;

  // Expansion uses native listeners on the region node. Touch is ignored so the stack stays collapsed on touch devices.
  effect(() => {
    const node = regionRef?.() as HTMLElement | undefined;
    if (!node) return;
    const doc = node.ownerDocument;

    untrack(() => {
      setRef(userRef, node);
    });

    // Focus is checked live against document.activeElement — focus events are unreliable when the focused toast is removed.
    const collapseIfOutside = () => {
      if (!pointerWithin && !node.contains(doc.activeElement)) {
        isPointerOrFocusWithin.set(false);
      }
    };

    const handlePointerEnterOrMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }

      pointerWithin = true;
      isPointerOrFocusWithin.set(true);
    };

    const handlePointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }

      pointerWithin = false;
      collapseIfOutside();
    };

    const handleFocusIn = () => {
      isPointerOrFocusWithin.set(true);
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && node.contains(event.relatedTarget)) {
        return;
      }

      collapseIfOutside();
    };

    // No browser fires pointerleave or focusout when the hovered or focused toast is removed; the only later signal is a pointerover on an outside target.
    const handleGlobalPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch" || node.contains(event.target as Node)) {
        return;
      }

      pointerWithin = false;
      collapseIfOutside();
    };

    // Escape folds the expanded stack; focus is released so the live focus check doesn't immediately re-expand it.
    const handleRegionKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (node.contains(doc.activeElement)) {
        (doc.activeElement as HTMLElement).blur();
      }

      pointerWithin = false;
      isPointerOrFocusWithin.set(false);
    };

    // The hotkey focuses the region (a landmark, so F6 works too); the focusin listener then expands the stack.
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      const hotkey = options.hotkey;

      if (hotkey.length === 0) {
        return;
      }

      // Modifiers match KeyboardEvent boolean props; other keys match event.code.
      const hasExpectedModifiers = MODIFIER_PROPS.every((modifier) => event[modifier] === hotkey.includes(modifier));
      const hasExpectedCodes = hotkey.every((key) => MODIFIER_PROPS.includes(key as (typeof MODIFIER_PROPS)[number]) || event.code === key);

      if (!hasExpectedModifiers || !hasExpectedCodes) {
        return;
      }

      // Claim the combination so the browser doesn't also act on it.
      event.preventDefault();
      node.focus();
    };

    node.addEventListener("pointerenter", handlePointerEnterOrMove);
    // pointermove re-expands when the stack shifts under a still cursor.
    node.addEventListener("pointermove", handlePointerEnterOrMove);
    node.addEventListener("pointerleave", handlePointerLeave);
    node.addEventListener("focusin", handleFocusIn);
    node.addEventListener("focusout", handleFocusOut);
    node.addEventListener("keydown", handleRegionKeyDown);
    doc.addEventListener("pointerover", handleGlobalPointerOver, true);
    doc.addEventListener("keydown", handleDocumentKeyDown);

    onCleanup(() => {
      node.removeEventListener("pointerenter", handlePointerEnterOrMove);
      node.removeEventListener("pointermove", handlePointerEnterOrMove);
      node.removeEventListener("pointerleave", handlePointerLeave);
      node.removeEventListener("focusin", handleFocusIn);
      node.removeEventListener("focusout", handleFocusOut);
      node.removeEventListener("keydown", handleRegionKeyDown);
      doc.removeEventListener("pointerover", handleGlobalPointerOver, true);
      doc.removeEventListener("keydown", handleDocumentKeyDown);

      // The region unmounts when the queue empties — reset so the next batch starts collapsed.
      pointerWithin = false;
    });
  });

  // Interacting with the stack pauses every timer. Not keyed on `isExpanded` — forced expansion does not pause timers.
  effect(() => {
    if (!exitAwareQueue || !isPointerOrFocusWithin()) {
      return;
    }

    untrack(() => exitAwareQueue.suspendTimers("interaction"));

    onCleanup(() => {
      exitAwareQueue.resumeTimers("interaction");
    });
  });

  // Pause timers while the page is hidden so toasts aren't missed in a background tab.
  const ownerDocument = getOwnerDocument() as Document | undefined;
  if (ownerDocument && exitAwareQueue) {
    const handleVisibilityChange = () => {
      if (ownerDocument.hidden) {
        exitAwareQueue.suspendTimers("visibility");
      } else {
        exitAwareQueue.resumeTimers("visibility");
      }
    };

    ownerDocument.addEventListener("visibilitychange", handleVisibilityChange);

    onCleanup(() => {
      ownerDocument.removeEventListener("visibilitychange", handleVisibilityChange);
      exitAwareQueue.resumeTimers("visibility");
    });
  }

  // A single remaining toast never expands; exiting toasts don't count.
  const isExpanded = computed(() => {
    const activeToastCount = state.visibleToasts().length - exitingKeys().size;
    return (options.isExpanded || isPointerOrFocusWithin()) && activeToastCount > 1;
  });

  const contextValue: ToastContext = {
    inToast: true,
    exitingKeys,
    gap: options.gap,
    heightsByKey: toastHeights,
    isExpanded,
    isMobile,
    maxVisibleToasts: options.maxVisibleToasts,
    onToastHeightChange: (key, height) => {
      const prev = untrack(toastHeights);
      if (prev[key] === height) return;
      toastHeights.set({ ...prev, [key]: height });
    },
    onToastHeightRemove: (key) => {
      const prev = untrack(toastHeights);
      if (!(key in prev)) return;
      const next = { ...prev };
      delete next[key];
      toastHeights.set(next);
    },
    placement: options.placement,
    scaleFactor: options.scaleFactor,
  };

  const regionClass = () => renderClass(composeTwRenderProps(options.class as never, slots.region()) as string | ((v: never) => string), renderProps);
  const regionStyle = (): CSSVars => {
    const userStyle = options.style;
    return {
      "--gap": `${options.gap}px`,
      "--placement": options.placement,
      "--scale-factor": options.scaleFactor,
      "--toast-width": typeof options.width === "number" ? `${options.width}px` : options.width,
      ...((typeof userStyle === "function" ? userStyle(renderProps as never) : userStyle) as CSSVars | undefined),
    };
  };
  const { children, class: _class, style: _style, ...rest } = attrs;

  return (
    <div {...(rest as {})} class={regionClass()} style={regionStyle()} data-expanded={dataAttr(isExpanded())} data-slot="toast-region">
      <Provider token={ToastContext} value={contextValue}>
        {(children as () => Content)()}
      </Provider>
    </div>
  );
};

const ToastProvider = <T extends object = ToastContentValue>(props: ToastProviderProps<T>): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, [
    "children",
    "class",
    "gap",
    "hotkey",
    "isExpanded",
    "maxVisibleToasts",
    "placement",
    "queue",
    "ref",
    "scaleFactor",
    "style",
    "width",
  ]);
  const queueProp = local.queue;
  const placement = (local.placement ?? "bottom") as ToastPlacement;
  const scaleFactor = local.scaleFactor ?? DEFAULT_SCALE_FACTOR;
  // The region consumes the underlying react-stately queue, not the wrapper.
  const toastQueue = (queueProp ? queueProp.getQueue() : defaultToastQueue.getQueue()) as unknown as StatelyToastQueue<T>;
  const queueLimit = queueProp && "maxVisibleToasts" in queueProp ? queueProp.maxVisibleToasts : undefined;
  const options: RegionOptions = {
    class: local.class as RegionOptions["class"],
    style: local.style as RegionOptions["style"],
    ref: local.ref,
    gap: local.gap ?? DEFAULT_GAP,
    hotkey: local.hotkey ?? DEFAULT_HOTKEY,
    isExpanded: local.isExpanded ?? false,
    maxVisibleToasts: local.maxVisibleToasts ?? queueLimit ?? DEFAULT_MAX_VISIBLE_TOAST,
    placement,
    scaleFactor,
    width: local.width ?? DEFAULT_TOAST_WIDTH,
  };
  const children = local.children;

  return (
    <ToastRegionPrimitive<T>
      {...(rest as object)}
      queue={toastQueue as never}
      render={(attrs, renderProps) => <ToastRegionHost attrs={attrs as never} renderProps={renderProps} options={options} />}
    >
      {(renderProps: { toast: QueuedToast<T> }) => {
        const content = renderProps.toast.content as ToastContentValue | undefined;
        const renderPropsWithIsLoading = { ...renderProps, isLoading: content?.isLoading ?? false };

        return typeof children === "undefined" ? (
          <DefaultToast toast={renderProps.toast as never} placement={placement} scaleFactor={scaleFactor} />
        ) : typeof children === "function" && !isSlot(children) ? (
          (children as (v: ToastRenderFunctionProps<T>) => Content)(renderPropsWithIsLoading)
        ) : (
          renderSlot(children as Content)
        );
      }}
    </ToastRegionPrimitive>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Exports
 * --------------------------------------------------------------------------------------------- */
export { Toast, ToastActionButton, ToastCloseButton, ToastContent, ToastDescription, ToastIndicator, ToastProvider, ToastTitle };

export type {
  ToastActionButtonProps,
  ToastCloseButtonProps,
  ToastContentProps,
  ToastDescriptionProps,
  ToastIndicatorProps,
  ToastPlacement,
  ToastProps,
  ToastProviderProps,
  ToastRenderFunctionProps,
  ToastTitleProps,
};
