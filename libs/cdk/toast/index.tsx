// Ported from react-aria-components (packages/react-aria-components/src/Toast.tsx: ToastRegion, ToastList,
// Toast, ToastContent, ToastStateContext, ToastContentContext), Apache-2.0, © Adobe.
// Rivet:
// - The region renders nothing on the server (RA: `useIsSSR` → no portal) and only while toasts are
//   visible, in the shared div overlay layer (`<Portal>`: the nearest PortalProvider's container, else
//   `document.body`). Browser-rendered: subscribes to `queue` at once. Resumed page: the region listens
//   for the queue's `rv-toast-queue` document event (a resumable `clientEvent`, chunk fetched on the
//   first toast, `preload: "interaction"`), connects to the queue named like its own (`queue.name`) and
//   renders the toasts. Nothing of the region loads before the first toast.
// - The queue (a class instance) is never captured by a resumable closure: bindings capture its
//   `name` and a signal of the visible toasts; the browser-created content finds the queue through a
//   module WeakMap keyed by that signal.
// - Render props are accessors (`class={({ isFocused }) => …}`); RAC `className` → `class`; `data-*`
//   state values are `"true"`. Toast children may be a function of `{ toast, isFocused, isFocusVisible }`.
// - `<Button slot="close">` gets the toast's close button props (`aria-label`, `onPress`) through
//   ButtonContext; `<Text slot="title|description">` its ids through TextContext.
// Deviations: `render` (RAC DOMRenderProps) on ToastRegion / ToastList / Toast / ToastContent (their element is replaced; the portal host stays); the region sits in a `<div data-rivet-portal>` host.
import { createContext, onCleanup, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { For, Provider as ContextProvider, Show, clientEvent, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { PortalContext, Portal } from "../portal/index.tsx";
import { useLocale } from "../i18n/index.ts";
import { useFocusRing } from "../focus/focus-ring.tsx";
import { hoverProps } from "../interactions/hover.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { slotChildren, type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { hasLive, isLive, liveClass, liveOmit, liveView } from "../utils/live.tsx";
import { liveRenderProps, renderPropsOf, type LiveRenderProps } from "../slots/index.tsx";
import {
  DEFAULT_SLOT,
  Provider,
  contextProps,
  renderProps,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type StyleRenderProps,
  type ClassNameOrFunction,
} from "../slots/index.tsx";
import { TextContext } from "../text/index.tsx";
import { ButtonContext } from "../button/index.tsx";
import { ToastQueue, type QueuedToast, type ToastState, type ToastOptions, type ToastStateProps } from "../state/toast.ts";
import { toastProps as ariaToastProps, toastRegionProps, type AriaToastProps, type AriaToastRegionProps } from "./behaviour.tsx";

export { toastProps, toastRegionProps, type AriaToastProps, type AriaToastRegionProps, type ToastAria } from "./behaviour.tsx";
export type { QueuedToast, ToastOptions, ToastState, ToastStateProps };

/** Props handled by the parts themselves (render-prop `style`), not forwarded by `globalDOMProps`. */
const OWNED = ["style"] as const;

/** RAC `ToastStateContext`: the region's toast state (browser-only value). */
const ToastStateContext = createContext<ToastState<any> | null>(null);

export interface ToastRegionRenderProps<T> {
  /** A list of all currently visible toasts. */
  visibleToasts: () => QueuedToast<T>[];
  /**
   * Whether the toast region is currently hovered with a mouse.
   * @selector [data-hovered]
   */
  isHovered: () => boolean;
  /**
   * Whether the toast region is currently focused.
   * @selector [data-focused]
   */
  isFocused: () => boolean;
  /**
   * Whether the toast region is keyboard focused.
   * @selector [data-focus-visible]
   */
  isFocusVisible: () => boolean;
}

export interface ToastRegionProps<T>
  extends
    AriaToastRegionProps,
    StyleRenderProps<ToastRegionRenderProps<T>>,
    DOMRenderProps<"div", ToastRegionRenderProps<T>>,
    GlobalDOMAttributes<HTMLDivElement> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   * @default 'rv-ToastRegion'
   */
  class?: ClassNameOrFunction<ToastRegionRenderProps<T>>;
  /** The queue of toasts to display. */
  queue: ToastQueue<T>;
  /** A function to render each toast, or children containing a `<ToastList>`. */
  children: Content | ((renderProps: { toast: QueuedToast<T> }) => Content);
}

// Visible-toasts signal → the queue it mirrors (browser only, never serialized).
const regionQueues = new WeakMap<Signal<QueuedToast<any>[]>, ToastQueue<any>>();

/** Mirror `queue` into `toasts` (once per signal); unsubscribes with the calling owner. */
function connectToastRegion<T>(queue: ToastQueue<T>, toasts: Signal<QueuedToast<T>[]>): void {
  if (regionQueues.has(toasts)) return;
  regionQueues.set(toasts, queue);
  const unsubscribe = queue.subscribe(() => toasts.set(queue.visibleToasts));
  onCleanup(() => {
    unsubscribe();
    regionQueues.delete(toasts);
  });
  toasts.set(queue.visibleToasts);
}

/** The region's ToastState over the mirrored signal. */
function regionState<T>(toasts: Signal<QueuedToast<T>[]>): ToastState<T> {
  const queue = () => regionQueues.get(toasts) as ToastQueue<T> | undefined;
  return {
    visibleToasts: toasts,
    add: (content, options) => queue()!.add(content, options),
    close: (key) => queue()?.close(key),
    pauseAll: () => queue()?.pauseAll(),
    resumeAll: () => queue()?.resumeAll(),
  };
}

/** A ToastRegion displays one or more toast notifications. */
function ToastRegion<T>(props: ToastRegionProps<T>) {
  const queue = props.queue;
  const name = queue.name;
  const toasts = signal<QueuedToast<T>[]>([]);
  if (typeof document !== "undefined") connectToastRegion(queue, toasts);
  // Resumed page: the queue wakes the server-rendered region with its first toast.
  clientEvent(
    document,
    "rv-toast-queue",
    (event) => {
      const detail = (event as CustomEvent<ToastQueue<T>>).detail;
      if (detail && detail.name === name) connectToastRegion(detail, toasts);
    },
    { preload: "interaction" },
  );
  const mount = useContext(PortalContext);
  const content = {
    dom: globalDOMProps(props, OWNED),
    ariaLabel: props["aria-label"],
    ariaLabelledby: props["aria-labelledby"],
    ariaDescribedby: props["aria-describedby"],
    className: props.class,
    style: props.style,
    children: props.children,
    render: props.render,
    // Live props (P5): a live class / style through a narrow live view (read in the region's bindings).
    live: hasLive(props) ? (liveRenderProps(props, ["class", "style"]) as never) : undefined,
  };
  // Rivet: an empty `display: contents` anchor gives the Show a server-rendered branch region to resume
  // (a component-root Show leaves nothing to wake on a resumed page).
  return (
    <span data-rv-toast-anchor="" style={{ display: "contents" }}>
      <Show when={() => toasts().length > 0}>
        {() => (
          <Portal mount={mount}>
            <ToastRegionContent toasts={toasts} content={content} />
          </Portal>
        )}
      </Show>
    </span>
  );
}

interface RegionContent<T> {
  dom: Record<string, unknown>;
  ariaLabel?: string;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
  className?: ClassNameOrFunction<ToastRegionRenderProps<T>>;
  style?: ToastRegionProps<T>["style"];
  children: ToastRegionProps<T>["children"];
  render?: ToastRegionProps<T>["render"];
  live?: LiveRenderProps<ToastRegionRenderProps<T>>;
}

function ToastRegionContent<T>(props: { toasts: Signal<QueuedToast<T>[]>; content: RegionContent<T> }) {
  const { toasts, content } = props;
  const state = regionState(toasts);
  const element = createRef<HTMLDivElement>();
  const { direction, locale } = useLocale();
  const regionProps = toastRegionProps(
    { "aria-label": content.ariaLabel, "aria-labelledby": content.ariaLabelledby, "aria-describedby": content.ariaDescribedby, locale },
    state,
    element,
  );
  const { focusProps, isFocused, isFocusVisible } = useFocusRing();
  const { hoverProps: regionHover, isHovered } = hoverProps({}, content.dom);
  // No function in the `rp` initializer: spread sites capture `rp.class` / `rp.style` (per-key live views).
  const rp = renderProps<ToastRegionRenderProps<T>>(
    {
      class: content.className,
      style: content.style,
      defaultClassName: "rv-ToastRegion",
      values: { visibleToasts: toasts, isHovered, isFocused, isFocusVisible },
    },
    content.live,
  );
  const merged = mergeProps(content.dom, regionProps, focusProps, regionHover) as Record<string, unknown>;
  const { role, tabIndex, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby, "aria-describedby": ariaDescribedby, ...rest } = merged;
  const label = ariaLabel as string | (() => string | undefined) | undefined;
  const children = content.children;
  const renderToast = typeof children === "function" && !isSlot(children) ? (children as (renderProps: { toast: QueuedToast<T> }) => Content) : null;
  if (content.render) {
    const attrs = {
      ...rest,
      ref: element,
      role: role as string,
      tabindex: tabIndex as number,
      "aria-label": () => (typeof label === "function" ? label() : label),
      "aria-labelledby": ariaLabelledby as string | undefined,
      "aria-describedby": ariaDescribedby as string | undefined,
      class: () => rp.class(),
      style: () => rp.style(),
      dir: direction,
      "data-hovered": () => dataBool(isHovered()),
      "data-focused": () => dataBool(isFocused()),
      "data-focus-visible": () => dataBool(isFocusVisible()),
      children: () => (renderToast ? <ToastList style={{ display: "contents" }}>{renderToast}</ToastList> : renderSlot(children as Content)),
    };
    return (
      <ContextProvider token={ToastStateContext} value={state}>
        {content.render(attrs as never, { visibleToasts: toasts, isHovered, isFocused, isFocusVisible })}
      </ContextProvider>
    );
  }
  return (
    <ContextProvider token={ToastStateContext} value={state}>
      <div
        {...rest}
        ref={element}
        role={role as string}
        tabIndex={tabIndex as number}
        aria-label={typeof label === "function" ? label() : label}
        aria-labelledby={ariaLabelledby as string | undefined}
        aria-describedby={ariaDescribedby as string | undefined}
        class={rp.class()}
        style={rp.style()}
        dir={direction}
        data-hovered={dataBool(isHovered())}
        data-focused={dataBool(isFocused())}
        data-focus-visible={dataBool(isFocusVisible())}
      >
        {renderToast ? <ToastList style={{ display: "contents" }}>{renderToast}</ToastList> : renderSlot(children as Content)}
      </div>
    </ContextProvider>
  );
}

export interface ToastListProps<T>
  extends Omit<StyleRenderProps<ToastRegionRenderProps<T>>, "class">, DOMRenderProps<"ol", ToastRegionRenderProps<T>>, GlobalDOMAttributes<HTMLOListElement> {
  /** @default 'rv-ToastList' */
  class?: ClassNameOrFunction<ToastRegionRenderProps<T>>;
  /** A function to render each toast. */
  children: (renderProps: { toast: QueuedToast<T> }) => Content;
}

/** RAC `ToastList`: an `<ol>` of the visible toasts (each in an `<li style="display:contents">`). */
function ToastList<T>(props: ToastListProps<T>) {
  const state = useContext(ToastStateContext) as ToastState<T>;
  const { hoverProps: listHover, isHovered } = hoverProps({}, props);
  // Options hoisted: no function in the `rp` initializer (spread sites capture `rp.class` / `rp.style`: per-key live views).
  const rpOptions = {
    defaultClassName: "rv-ToastList",
    values: { visibleToasts: state.visibleToasts, isFocused: () => false, isFocusVisible: () => false, isHovered },
  };
  const rp = renderPropsOf<ToastRegionRenderProps<T>>(props as never, rpOptions, ["class", "style"]);
  const dom = mergeProps(globalDOMProps(props, OWNED), listHover);
  const render = props.children;
  if (props.render) {
    const attrs = {
      ...dom,
      class: () => rp.class(),
      style: () => rp.style(),
      children: () => (
        <For each={state.visibleToasts} by={(toast) => toast.key}>
          {(toast) => <li style={{ display: "contents" }}>{render({ toast: toast() })}</li>}
        </For>
      ),
    };
    return props.render(attrs as never, { visibleToasts: state.visibleToasts, isFocused: () => false, isFocusVisible: () => false, isHovered });
  }
  return (
    <ol {...dom} class={rp.class()} style={rp.style()}>
      <For each={state.visibleToasts} by={(toast) => toast.key}>
        {(toast) => <li style={{ display: "contents" }}>{render({ toast: toast() })}</li>}
      </For>
    </ol>
  );
}

export interface ToastRenderProps<T> {
  /** The toast object to display. */
  toast: QueuedToast<T>;
  /**
   * Whether the toast is currently focused.
   * @selector [data-focused]
   */
  isFocused: () => boolean;
  /**
   * Whether the toast is keyboard focused.
   * @selector [data-focus-visible]
   */
  isFocusVisible: () => boolean;
}

export interface ToastProps<T>
  extends Omit<AriaToastProps<T>, "locale">, RenderProps<ToastRenderProps<T>>, DOMRenderProps<"div", ToastRenderProps<T>>, GlobalDOMAttributes<HTMLDivElement> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   * @default 'rv-Toast'
   */
  class?: ClassNameOrFunction<ToastRenderProps<T>>;
  id?: string;
}

/**
 * A Toast displays a brief, temporary notification of actions, errors, or other events in an
 * application.
 */
function Toast<T>(props: ToastProps<T>) {
  const state = useContext(ToastStateContext) as ToastState<T>;
  const { locale } = useLocale();
  const aria = ariaToastProps({ ...props, locale }, state);
  const { focusProps, isFocused, isFocusVisible } = useFocusRing();
  const toast = props.toast;
  const rp = renderPropsOf<ToastRenderProps<T>>(props, { defaultClassName: "rv-Toast", values: { toast, isFocused, isFocusVisible } });
  const merged = mergeProps(globalDOMProps(props, OWNED), aria.toastProps, focusProps) as Record<string, unknown>;
  const { "aria-describedby": describedBy, ...rest } = merged;
  const titleProps = aria.titleProps;
  const descriptionProps = aria.descriptionProps;
  const contentProps = aria.contentProps;
  const closeButtonProps = aria.closeButtonProps;
  if (props.render) {
    const attrs = {
      ...rest,
      "aria-describedby": () => (typeof describedBy === "function" ? describedBy() : (describedBy as string | undefined)),
      class: () => rp.class(),
      style: () => rp.style(),
      "data-focused": () => dataBool(isFocused()),
      "data-focus-visible": () => dataBool(isFocusVisible()),
      children: () => (
        <Provider
          values={[
            [ToastContentContext, contentProps],
            [TextContext, { slots: { [DEFAULT_SLOT]: {}, title: titleProps, description: descriptionProps } }],
            [ButtonContext, { slots: { [DEFAULT_SLOT]: {}, close: closeButtonProps } }],
          ]}
        >
          {rp.children()}
        </Provider>
      ),
    };
    return props.render(attrs as never, { toast, isFocused, isFocusVisible });
  }
  return (
    <div
      {...rest}
      aria-describedby={typeof describedBy === "function" ? describedBy() : (describedBy as string | undefined)}
      class={rp.class()}
      style={rp.style()}
      data-focused={dataBool(isFocused())}
      data-focus-visible={dataBool(isFocusVisible())}
    >
      <Provider
        values={[
          [ToastContentContext, contentProps],
          [TextContext, { slots: { [DEFAULT_SLOT]: {}, title: titleProps, description: descriptionProps } }],
          [ButtonContext, { slots: { [DEFAULT_SLOT]: {}, close: closeButtonProps } }],
        ]}
      >
        {rp.children()}
      </Provider>
    </div>
  );
}

export interface ToastContentProps extends DOMRenderProps<"div", undefined>, GlobalDOMAttributes<HTMLDivElement> {
  id?: string;
  class?: string;
  style?: Record<string, string | number | undefined>;
  role?: string;
  ref?: RefValue<HTMLDivElement>;
  children?: Content;
}

/** RAC `ToastContentContext` (Toast provides the alert's props). */
export const ToastContentContext = createContext<ContextValue<ToastContentProps, HTMLDivElement>>({});

/** ToastContent wraps the main content of a toast notification. */
export function ToastContent(props: ToastContentProps) {
  const [merged, ref] = contextProps(props, props.ref, ToastContentContext);
  // Live props (P5): a live `class` / children go through the spread / a binding (rest forwarded unread); body untracked.
  if (hasLive(merged)) return untrack(() => liveToastContent(merged as ToastContentProps & Record<string, unknown>, ref));
  const { children, "aria-hidden": hidden, class: className, render, ...rest } = merged as ToastContentProps & Record<string, unknown>;
  if (render)
    return (render as NonNullable<ToastContentProps["render"]>)(
      {
        ...rest,
        ref: ref as never,
        class: className ?? "rv-ToastContent",
        "aria-hidden": () => (typeof hidden === "function" ? (hidden as () => string | undefined)() : (hidden as string | undefined)),
        children: slotChildren(children),
      } as never,
      undefined,
    );
  return (
    <div
      {...rest}
      ref={ref as never}
      class={className ?? "rv-ToastContent"}
      aria-hidden={typeof hidden === "function" ? (hidden as () => string | undefined)() : (hidden as string | undefined)}
    >
      {children}
    </div>
  );
}

function liveToastContent(merged: ToastContentProps & Record<string, unknown>, ref: unknown) {
  const rest = liveOmit(merged, ["children", "class", "render", "ref"] as never) as Record<string, unknown>;
  const view = liveView(merged, ["children"]) as { children?: unknown };
  const render = merged.render;
  // `class` is an accessor the spread binds.
  const attrs = { ...rest, class: liveClass(merged, "rv-ToastContent") as unknown as string };
  if (render)
    return (render as NonNullable<ToastContentProps["render"]>)(
      { ...attrs, ref: ref as never, children: () => renderSlot(view.children as never) } as never,
      undefined,
    );
  return (
    <div {...attrs} ref={ref as never}>
      {() => renderSlot(view.children as never)}
    </div>
  );
}

export {
  Toast as UNSTABLE_Toast,
  ToastList as UNSTABLE_ToastList,
  ToastRegion as UNSTABLE_ToastRegion,
  ToastContent as UNSTABLE_ToastContent,
  ToastStateContext as UNSTABLE_ToastStateContext,
  ToastQueue as UNSTABLE_ToastQueue,
};
