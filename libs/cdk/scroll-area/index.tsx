// Ported from @radix-ui/react-scroll-area 1.3.0 (src/scroll-area.tsx, src/use-state-machine.ts), MIT, © 2022 WorkOS
// (https://github.com/radix-ui/primitives packages/react/scroll-area; read from the published tarball's source map), with
// @radix-ui/number `clamp`, @radix-ui/primitive `composeEventHandlers`, @radix-ui/react-direction `useDirection`,
// @radix-ui/react-use-callback-ref / react-use-layout-effect folded in (MIT, © 2022 WorkOS).
// Augments native scroll: the Viewport scrolls natively (native scrollbars hidden: inline `scrollbar-width: none` + one nonce'd `::-webkit-scrollbar` style per document), custom
// scrollbars mirror its scroll metrics — thumb size from viewport / content ratio (min 18 px, macOS), thumb position
// from the scroll offset (rAF loop while scrolling, no scroll-linked effects), thumb drag, track click (page to the
// pointer), wheel over a scrollbar scrolls the viewport, RTL, ResizeObserver re-measures. Scrollbar visibility by
// `type`: `hover` (pointer over the root, hidden `scrollHideDelay` ms after it leaves) / `scroll` (while scrolling or
// interacting, state machine) / `auto` (when the content overflows) / `always`.
// Rivet:
// - fine-grained: element refs (`ref()` signals), sizes, visibility states and corner sizes are signals in the
//   resumable contexts `rv-scroll-area` / `rv-scroll-area-scrollbar`; nothing re-renders, bindings update the `style`
//   (CSS variables) / `data-state`; Radix `useEffect` / `useLayoutEffect` → `clientEffect` (ResizeObserver, listeners).
// - SSR renders the Root, Viewport and Content; scrollbars only for `type="always"` (or `forceMount`), as static markup
//   (no thumb), thumbs / corner once measured on the client.
// - activation (`active` in the context): a server-rendered area is inactive — the viewport scrolls natively on both
//   axes, no part runs client code — until the first `pointerenter` / `wheel` / `focusin` on the Root or `scroll` of the
//   Viewport (delegated handlers, `preload="interaction"`), or, for `type="auto"` / `"always"` (their first frame needs
//   measuring), the Root coming into view (`clientEffect` `when: "visible"`). Each Scrollbar is a `Show` over `active`:
//   activation re-creates it with the Radix behaviour (axis enabling, measuring, listeners); the activating
//   `pointerenter` / `scroll` is caught up on (`:hover`, scroll offset vs the server's 0). A client render is active
//   from the start (Radix exactly).
// - `asChild` → cdk `render` prop on every part (`render(attrs)`, spread `attrs` onto your element).
// - `Presence` → `./presence.tsx` (`createPresence` + `Show`), exit animations kept.
// - `useDirection(dir)`: the nearest cdk `<Dir>` (`@rivetjs/cdk/bidi-dir`, `DirectionalityContext`) stands in for the
//   Radix `DirectionProvider`; default `ltr`.
// - parts accept every `<div>` attribute (Radix `Primitive.div`); default classes `rv-ScrollArea`, `rv-ScrollAreaViewport`,
//   `rv-ScrollAreaContent`, `rv-ScrollAreaScrollbar`, `rv-ScrollAreaThumb`, `rv-ScrollAreaCorner` when `class` is omitted.
// - `type`, `dir`, `scrollHideDelay`, `orientation`, `forceMount`, `nonce` are read when the part is created.
// - user handlers run first and a `preventDefault()` skips the part's own (Radix `composeEventHandlers`).
// - component-owned state (visibility, machine, sizes, presence, timers) is `_regionState`: a part re-created on a
//   resumed page (first signal change) continues from the same values; Scrollbar mount flags (`scrollbarXMounted` /
//   `YMounted`, set from a `clientEffect`) drive the Corner — revived `ref()` signals already hold the server element.
// Deviations (documented in scroll-area/CLAUDE.md):
// - names `--radix-scroll-area-*` → `--rv-scroll-area-thumb-width` / `-thumb-height` / `-corner-width` / `-corner-height`,
//   `data-radix-scroll-area-viewport` → `data-rv-scroll-area-viewport`;
// - the Thumb records the pointer offset in a bubbling `pointerdown` (Radix: `onPointerDownCapture`; capture handlers
//   are not resumable) — it still runs before the Scrollbar's own handler (inner element first);
// - the Thumb's rAF scroll loop stops when the Thumb unmounts (Radix leaves it running until the page unloads);
// - the `asChild` single-child dev warning has no counterpart (`render` replaces `asChild`);
// - the native-scrollbar `<style>` Radix renders next to every Viewport → inline hiding styles + `insertViewportStyle`
//   (`./dom.ts`, client, once per document, nonce'd; JSX has no `<style>` content);
// - `type="scroll"`: the scroll-end debounce timer is not cleared on unmount (a re-created part keeps the timer);
// - before activation both viewport axes are `overflow: scroll` (Radix: `hidden` until the scrollbars mount).
import { _regionState, computed, createContext, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { Provider, Show, clientEffect, ref as createRef, type Ref } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { splitProps } from "@rivetjs/runtime/props";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { DirectionalityContext } from "../bidi/index.ts";
import { getNonce } from "../utils/dom.ts";
import { addUnlinkedScrollListener, insertViewportStyle, observeResize } from "./dom.ts";
import { mergeRefValues, type RefValue } from "../slots/index.tsx";
import type { DOMRenderProps } from "../utils/render.ts";
import type { StyleObject } from "../utils/types.ts";
import { createPresence, isPresent } from "./presence.tsx";

export type ScrollAreaType = "auto" | "always" | "scroll" | "hover";
export type ScrollAreaOrientation = "vertical" | "horizontal";
export type ScrollAreaDirection = "ltr" | "rtl";

interface Sizes {
  content: number;
  viewport: number;
  scrollbar: { size: number; paddingStart: number; paddingEnd: number };
}

const EMPTY_SIZES: Sizes = { content: 0, viewport: 0, scrollbar: { size: 0, paddingStart: 0, paddingEnd: 0 } };

/** Every `<div>` attribute (Radix `Primitive.div` props) except the ones a part types itself. */
type DivAttributes = Omit<JSX.IntrinsicElements["div"], "children" | "style" | "ref" | "class" | "dir">;

interface PartProps extends DivAttributes, DOMRenderProps<"div", undefined> {
  class?: string;
  style?: StyleObject;
  ref?: RefValue<HTMLDivElement>;
  children?: Content;
}

/* -------------------------------------------------------------------------------------------------
 * Contexts
 * -----------------------------------------------------------------------------------------------*/

export interface ScrollAreaContextValue {
  type: ScrollAreaType;
  dir: ScrollAreaDirection;
  scrollHideDelay: number;
  scrollArea: Ref<HTMLDivElement>;
  viewport: Ref<HTMLDivElement>;
  content: Ref<HTMLDivElement>;
  scrollbarX: Ref<HTMLDivElement>;
  scrollbarY: Ref<HTMLDivElement>;
  scrollbarXEnabled: Signal<boolean>;
  scrollbarYEnabled: Signal<boolean>;
  /** Whether the scrollbar element of an axis is mounted (Radix: `scrollbarX` / `scrollbarY` state non-null). */
  scrollbarXMounted: Signal<boolean>;
  scrollbarYMounted: Signal<boolean>;
  cornerWidth: Signal<number>;
  cornerHeight: Signal<number>;
  /**
   * Whether the parts run their client behaviour (Rivet). `false` on the server: a resumed page stays static — native
   * scrolling, no scrollbar code — until the first `pointerenter` / `wheel` / `focusin` on the Root or `scroll` of the
   * Viewport (`type="auto"` / `"always"`: also when the Root becomes visible, they need measuring); `true` from the
   * start in a client render.
   */
  active: Signal<boolean>;
}

/** The Root's state (Radix `ScrollAreaProvider`). */
export const ScrollAreaContext = resumableContext(createContext<ScrollAreaContextValue | null>(null, { id: "rv-scroll-area" }));

interface ScrollbarContextValue {
  isHorizontal: boolean;
  sizes: Signal<Sizes>;
  hasThumb: () => boolean;
  thumb: Ref<HTMLDivElement>;
  /** Radix `pointerOffsetRef`: where the pointer grabbed the thumb (0: not dragging the thumb → centre). */
  pointerOffset: { current: number };
}

/** A Scrollbar's state (Radix `ScrollbarProvider`). */
const ScrollbarContext = resumableContext(createContext<ScrollbarContextValue | null>(null, { id: "rv-scroll-area-scrollbar" }));

/** Radix `createContext` consumer: throws outside the provider. */
function useScrollAreaContext(consumerName: string): ScrollAreaContextValue {
  const context = useContext(ScrollAreaContext);
  if (!context) throw new Error(`\`${consumerName}\` must be used within \`ScrollArea\``);
  return context;
}

function useScrollbarContext(consumerName: string): ScrollbarContextValue {
  const context = useContext(ScrollbarContext);
  if (!context) throw new Error(`\`${consumerName}\` must be used within \`ScrollAreaScrollbar\``);
  return context;
}

/* -------------------------------------------------------------------------------------------------
 * ScrollArea (Root)
 * -----------------------------------------------------------------------------------------------*/

export interface ScrollAreaProps extends PartProps {
  /**
   * Describes the nature of scrollbar visibility, similar to how the scrollbar preferences in macOS control
   * visibility of native scrollbars. `auto`: visible when content is overflowing on the corresponding orientation;
   * `always`: always visible regardless of overflow; `scroll`: visible while scrolling; `hover`: visible while
   * scrolling and while the pointer is over the scroll area. @default "hover"
   */
  type?: ScrollAreaType;
  /** The reading direction of the scroll area (inherits from a `<Dir>` ancestor). @default "ltr" */
  dir?: ScrollAreaDirection;
  /** With `type="scroll"` / `"hover"`: the delay in milliseconds before the scrollbars hide after the user stops interacting. @default 600 */
  scrollHideDelay?: number;
}

const ROOT_KEYS = ["type", "dir", "scrollHideDelay", "class", "style", "ref", "render", "children", "onPointerEnter", "onWheel", "onFocusIn"] as const;

type Handler<E extends Event> = ((event: E & { currentTarget: HTMLDivElement }) => void) | undefined;

/** Augments native scroll functionality for custom, cross-browser styling (Radix `ScrollArea.Root`). */
export function ScrollArea(props: ScrollAreaProps) {
  const [local, rest] = splitProps(props as Record<string, unknown>, ROOT_KEYS) as unknown as [ScrollAreaProps, DivAttributes];
  const directionality = useContext(DirectionalityContext);
  const direction: ScrollAreaDirection = local.dir || (directionality ? untrack(directionality.valueSignal) : undefined) || "ltr";
  // Component-owned (`_regionState`): a Root re-created on a resumed page continues from the server's state.
  const value: ScrollAreaContextValue = _regionState(() => ({
    type: local.type ?? "hover",
    dir: direction,
    scrollHideDelay: local.scrollHideDelay ?? 600,
    scrollArea: createRef<HTMLDivElement>(),
    viewport: createRef<HTMLDivElement>(),
    content: createRef<HTMLDivElement>(),
    scrollbarX: createRef<HTMLDivElement>(),
    scrollbarY: createRef<HTMLDivElement>(),
    scrollbarXEnabled: signal(false),
    scrollbarYEnabled: signal(false),
    scrollbarXMounted: signal(false),
    scrollbarYMounted: signal(false),
    cornerWidth: signal(0),
    cornerHeight: signal(0),
    // Server render: inactive until the first interaction (resumed pages load no scroll-area code before it).
    active: signal(typeof document !== "undefined"),
  }));
  const ref = mergeRefValues(value.scrollArea, local.ref) as never;
  const cls = local.class ?? "rv-ScrollArea";
  const userStyle = local.style;
  const cornerWidth = value.cornerWidth;
  const cornerHeight = value.cornerHeight;
  const children = local.children;
  const active = value.active;
  const onPointerEnter = local.onPointerEnter as Handler<PointerEvent>;
  const onWheel = local.onWheel as Handler<WheelEvent>;
  const onFocusIn = local.onFocusIn as Handler<FocusEvent>;
  // Types whose first frame depends on measuring (overflow / thumb size) activate when the Root comes into view.
  if (value.type === "auto" || value.type === "always") {
    const scrollArea = value.scrollArea;
    clientEffect(
      () => {
        if (scrollArea()) active.set(true);
      },
      { when: "visible" },
    );
  }
  if (local.render)
    return local.render(
      {
        dir: direction,
        ...rest,
        ref,
        class: cls,
        onPointerEnter: (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
          onPointerEnter?.(event);
          active.set(true);
        },
        onWheel: (event: WheelEvent & { currentTarget: HTMLDivElement }) => {
          onWheel?.(event);
          active.set(true);
        },
        onFocusIn: (event: FocusEvent & { currentTarget: HTMLDivElement }) => {
          onFocusIn?.(event);
          active.set(true);
        },
        // Corner sizes as CSS variables (Radix: fewer re-renders of context consumers).
        style: () => ({
          position: "relative",
          "--rv-scroll-area-corner-width": cornerWidth() + "px",
          "--rv-scroll-area-corner-height": cornerHeight() + "px",
          ...userStyle,
        }),
        children: () => (
          <Provider token={ScrollAreaContext} value={value}>
            {children}
          </Provider>
        ),
      } as never,
      undefined,
    );
  return (
    <div
      dir={direction}
      {...rest}
      ref={ref}
      class={cls}
      preload="visible"
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        active.set(true);
      }}
      onWheel={(event) => {
        onWheel?.(event);
        active.set(true);
      }}
      onFocusIn={(event) => {
        onFocusIn?.(event);
        active.set(true);
      }}
      style={{
        position: "relative",
        "--rv-scroll-area-corner-width": cornerWidth() + "px",
        "--rv-scroll-area-corner-height": cornerHeight() + "px",
        ...userStyle,
      }}
    >
      <Provider token={ScrollAreaContext} value={value}>
        {children}
      </Provider>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ScrollAreaViewport
 * -----------------------------------------------------------------------------------------------*/

export interface ScrollAreaViewportProps extends PartProps {
  /** Nonce of the `<style>` that hides the native scrollbars (CSP). */
  nonce?: string;
  /**
   * Disables implicit rendering of an additional wrapper element that measures the content size. When `true`, a
   * child `<ScrollAreaContent>` must be rendered as a direct child of the viewport.
   */
  disableImplicitContentElement?: boolean;
}

const VIEWPORT_KEYS = ["children", "nonce", "disableImplicitContentElement", "class", "style", "ref", "render", "onScroll"] as const;

/** The viewport area of the scroll area: scrolls natively (Radix `ScrollArea.Viewport`). */
export function ScrollAreaViewport(props: ScrollAreaViewportProps) {
  const [local, rest] = splitProps(props as Record<string, unknown>, VIEWPORT_KEYS) as unknown as [ScrollAreaViewportProps, DivAttributes];
  const context = useScrollAreaContext("ScrollAreaViewport");
  const ref = mergeRefValues(context.viewport, local.ref) as never;
  const cls = local.class ?? "rv-ScrollAreaViewport";
  const userStyle = local.style;
  const nonce = local.nonce;
  const xEnabled = context.scrollbarXEnabled;
  const yEnabled = context.scrollbarYEnabled;
  const children = local.children;
  const implicit = !local.disableImplicitContentElement;
  const active = context.active;
  const onScroll = local.onScroll as Handler<Event>;
  // `overflow: scroll` on an enabled axis (the native scrollbar is hidden by the style; `visible` would act as `auto`).
  // Before activation (server, resumed page) both axes scroll natively: the server cannot know which Scrollbars follow.
  // Legacy WebKit (no `scrollbar-width`): the `::-webkit-scrollbar` rule needs a stylesheet (`ViewportStyle`, once active).
  if (local.render)
    return local.render(
      {
        "data-rv-scroll-area-viewport": "",
        ...rest,
        ref,
        class: cls,
        onScroll: (event: Event & { currentTarget: HTMLDivElement }) => {
          onScroll?.(event);
          active.set(true);
        },
        style: () => ({
          ...HIDE_NATIVE_SCROLLBAR,
          overflowX: xEnabled() || !active() ? "scroll" : "hidden",
          overflowY: yEnabled() || !active() ? "scroll" : "hidden",
          ...userStyle,
        }),
        children: () => (
          <>
            <Show when={active}>{() => <ViewportStyle nonce={nonce} />}</Show>
            {implicit ? <ScrollAreaContent>{children}</ScrollAreaContent> : children}
          </>
        ),
      } as never,
      undefined,
    );
  return (
    <div
      data-rv-scroll-area-viewport=""
      {...rest}
      ref={ref}
      class={cls}
      preload="visible"
      onScroll={(event) => {
        onScroll?.(event);
        active.set(true);
      }}
      style={{
        ...HIDE_NATIVE_SCROLLBAR,
        overflowX: xEnabled() || !active() ? "scroll" : "hidden",
        overflowY: yEnabled() || !active() ? "scroll" : "hidden",
        ...userStyle,
      }}
    >
      <Show when={active}>{() => <ViewportStyle nonce={nonce} />}</Show>
      {implicit ? <ScrollAreaContent>{children}</ScrollAreaContent> : children}
    </div>
  );
}

/** Inserts the document's native-scrollbar stylesheet once the area is active (client only). */
function ViewportStyle(props: { nonce: string | undefined }) {
  const nonce = props.nonce;
  clientEffect(() => insertViewportStyle(nonce ?? getNonce()));
  return null;
}

/** Radix `ScrollAreaViewportStyle` declarations, inline (SSR-safe, CSP-safe, not keyed on a class). */
const HIDE_NATIVE_SCROLLBAR: StyleObject = { scrollbarWidth: "none", "-ms-overflow-style": "none", "-webkit-overflow-scrolling": "touch" };

/* -------------------------------------------------------------------------------------------------
 * ScrollAreaContent
 * -----------------------------------------------------------------------------------------------*/

export interface ScrollAreaContentProps extends PartProps {}

const CONTENT_KEYS = ["children", "class", "style", "ref", "render"] as const;

/**
 * The measured content of the viewport (Radix `ScrollArea.Content`): rendered implicitly by the Viewport unless it
 * has `disableImplicitContentElement`. `display: table` makes it match the size of its children on both axes, so a
 * change of the scroll size re-measures the thumbs.
 */
export function ScrollAreaContent(props: ScrollAreaContentProps) {
  const [local, rest] = splitProps(props as Record<string, unknown>, CONTENT_KEYS) as unknown as [ScrollAreaContentProps, DivAttributes];
  const context = useScrollAreaContext("ScrollAreaContent");
  const ref = mergeRefValues(context.content, local.ref) as never;
  const cls = local.class ?? "rv-ScrollAreaContent";
  const style = { minWidth: "100%", display: "table", ...local.style };
  const children = local.children;
  if (local.render) return local.render({ ...rest, ref, class: cls, style, children } as never, undefined);
  return (
    <div {...rest} ref={ref} class={cls} style={style}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ScrollAreaScrollbar
 * -----------------------------------------------------------------------------------------------*/

export interface ScrollAreaScrollbarProps extends PartProps {
  /** @default "vertical" */
  orientation?: ScrollAreaOrientation;
  /** Mount the scrollbar whatever its visibility (animation libraries). */
  forceMount?: true;
}

/** The vertical or horizontal scrollbar (Radix `ScrollArea.Scrollbar`); its visibility follows the Root's `type`. */
export function ScrollAreaScrollbar(props: ScrollAreaScrollbarProps) {
  const context = useScrollAreaContext("ScrollAreaScrollbar");
  const active = context.active;
  // Rendered by the server before activation (a resumed re-creation keeps `true`; a client render: `false`). The
  // activating event already happened when the scrollbar code runs: `hover` / `scroll` catch up on it.
  const server = _regionState(() => ({ value: !untrack(active) }));
  // Server: enable the axis now (serialized with the context), so the Viewport keeps `overflow: scroll` on it through
  // activation while this scrollbar's code may still be loading (no `hidden` window under a running scroll).
  if (!untrack(active)) (props.orientation === "horizontal" ? context.scrollbarXEnabled : context.scrollbarYEnabled).set(true);
  const type = context.type;
  // Before activation: the server's first frame, no behaviour (`always`, `forceMount`: the static track, no thumb).
  const placeholder = type === "always" || (!!props.forceMount && type !== "hover");
  // `fallback` is a function: JSX in a conditional prop would be created eagerly (and its ref called) in a client render.
  return (
    <Show when={active} fallback={placeholder ? () => <ScrollbarStatic p={props} state={type === "always" ? "visible" : "hidden"} /> : undefined}>
      {() => <ScrollbarActive p={props} server={server.value} />}
    </Show>
  );
}

function ScrollbarActive(props: { p: ScrollAreaScrollbarProps; server: boolean }) {
  const p = props.p;
  const server = props.server;
  const context = useScrollAreaContext("ScrollAreaScrollbar");
  const enabled = p.orientation === "horizontal" ? context.scrollbarXEnabled : context.scrollbarYEnabled;
  clientEffect(() => {
    enabled.set(true);
    return () => enabled.set(false);
  });
  const type = context.type;
  if (type === "hover") return <ScrollbarHover p={p} server={server} />;
  if (type === "scroll") return <ScrollbarScroll p={p} server={server} />;
  if (type === "auto") return <ScrollbarAuto p={p} forceMount={p.forceMount} />;
  if (type === "always") return <ScrollbarVisible p={p} dataState={{ get: () => "visible" }} />;
  return null;
}

/** The scrollbar's server markup before activation (`ScrollbarVisible` with empty sizes; no handlers, no children). */
function ScrollbarStatic(props: { p: ScrollAreaScrollbarProps; state: "visible" | "hidden" }) {
  const [local, rest] = splitProps(props.p as Record<string, unknown>, SCROLLBAR_KEYS) as unknown as [ScrollAreaScrollbarProps, DivAttributes];
  const context = useScrollAreaContext("ScrollAreaScrollbar");
  const orientation: ScrollAreaOrientation = local.orientation === "horizontal" ? "horizontal" : "vertical";
  const ref = mergeRefValues(createRef<HTMLDivElement>(), local.ref) as never;
  const cls = local.class ?? "rv-ScrollAreaScrollbar";
  const style = scrollbarStyle(orientation === "horizontal", context.dir, EMPTY_SIZES, local.style);
  const state = props.state;
  if (local.render) return local.render({ "data-orientation": orientation, "data-state": state, ...rest, ref, class: cls, style } as never, undefined);
  return <div data-orientation={orientation} data-state={state} {...rest} ref={ref} class={cls} style={style} />;
}

/** The scrollbar element of an orientation (Radix composes it into the context: `onScrollbarXChange` / `Y`). */
const scrollbarRef = (context: ScrollAreaContextValue, p: ScrollAreaScrollbarProps): Ref<HTMLDivElement> =>
  p.orientation === "horizontal" ? context.scrollbarX : context.scrollbarY;

/** `data-state` of a scrollbar, given by the visibility wrapper (an object-literal accessor: resumable). */
interface DataState {
  get: () => "visible" | "hidden";
}

/* ---- type="hover" ---- */

function ScrollbarHover(props: { p: ScrollAreaScrollbarProps; server: boolean }) {
  const p = props.p;
  const server = props.server;
  const context = useScrollAreaContext("ScrollAreaScrollbar");
  const visible = _regionState(() => signal(false));
  const forceMount = p.forceMount;
  clientEffect(() => {
    const scrollArea = context.scrollArea();
    const delay = context.scrollHideDelay;
    if (!scrollArea) return;
    // Activated by the pointer entering (resumed page): that `pointerenter` came before this listener.
    if (server && scrollArea.matches(":hover")) visible.set(true);
    let hideTimer = 0;
    const handlePointerEnter = () => {
      window.clearTimeout(hideTimer);
      visible.set(true);
    };
    const handlePointerLeave = () => {
      hideTimer = window.setTimeout(() => visible.set(false), delay);
    };
    scrollArea.addEventListener("pointerenter", handlePointerEnter);
    scrollArea.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      window.clearTimeout(hideTimer);
      scrollArea.removeEventListener("pointerenter", handlePointerEnter);
      scrollArea.removeEventListener("pointerleave", handlePointerLeave);
    };
  });
  const presence = createPresence({ present: () => !!forceMount || visible(), node: scrollbarRef(context, p) });
  // Radix renders `ScrollAreaScrollbarAuto` without `forceMount` here: overflow still decides inside.
  return (
    <Show when={() => isPresent(presence())}>
      {() => <ScrollbarAuto p={p} forceMount={undefined} dataState={{ get: () => (visible() ? "visible" : "hidden") }} />}
    </Show>
  );
}

/* ---- type="scroll" ---- */

type ScrollState = "hidden" | "scrolling" | "interacting" | "idle";
type ScrollEvent = "SCROLL" | "SCROLL_END" | "POINTER_ENTER" | "POINTER_LEAVE" | "HIDE";

const SCROLL_MACHINE: Record<ScrollState, Partial<Record<ScrollEvent, ScrollState>>> = {
  hidden: { SCROLL: "scrolling" },
  scrolling: { SCROLL_END: "idle", POINTER_ENTER: "interacting" },
  interacting: { SCROLL: "interacting", POINTER_LEAVE: "idle" },
  idle: { HIDE: "hidden", SCROLL: "scrolling", POINTER_ENTER: "interacting" },
};

/** Radix `useStateMachine` step. */
function sendScroll(state: Signal<ScrollState>, event: ScrollEvent): void {
  const next = SCROLL_MACHINE[untrack(state)][event];
  if (next) state.set(next);
}

function ScrollbarScroll(props: { p: ScrollAreaScrollbarProps; server: boolean }) {
  const p = props.p;
  const server = props.server;
  const context = useScrollAreaContext("ScrollAreaScrollbar");
  const isHorizontal = p.orientation === "horizontal";
  const forceMount = p.forceMount;
  const state = _regionState(() => signal<ScrollState>("hidden"));
  // Radix `useDebounceCallback(() => send('SCROLL_END'), 100)`: one timer for the part's lifetime. Not cleared on
  // unmount (Radix clears it): a part re-created on a resumed page (first state change) continues the same timer and
  // state signal; a late `SCROLL_END` on an unmounted part changes nothing.
  const scrollEnd = _regionState(() => ({ timer: 0 }));
  clientEffect(() => {
    if (state() !== "idle") return;
    const delay = context.scrollHideDelay;
    const hideTimer = window.setTimeout(() => sendScroll(state, "HIDE"), delay);
    return () => window.clearTimeout(hideTimer);
  });
  clientEffect(() => {
    const viewport = context.viewport();
    if (!viewport) return;
    const scrollDirection = isHorizontal ? "scrollLeft" : "scrollTop";
    // Resumed page: compare with the server's position (0), so a scroll that activated the area shows its scrollbar.
    let prevScrollPos = server ? 0 : viewport[scrollDirection];
    const handleScroll = () => {
      const scrollPos = viewport[scrollDirection];
      if (prevScrollPos !== scrollPos) {
        sendScroll(state, "SCROLL");
        window.clearTimeout(scrollEnd.timer);
        scrollEnd.timer = window.setTimeout(() => sendScroll(state, "SCROLL_END"), 100);
      }
      prevScrollPos = scrollPos;
    };
    viewport.addEventListener("scroll", handleScroll);
    if (server) handleScroll();
    return () => viewport.removeEventListener("scroll", handleScroll);
  });
  const presence = createPresence({ present: () => !!forceMount || state() !== "hidden", node: scrollbarRef(context, p) });
  return (
    <Show when={() => isPresent(presence())}>
      {() => <ScrollbarVisible p={p} dataState={{ get: () => (state() === "hidden" ? "hidden" : "visible") }} machine={state} />}
    </Show>
  );
}

/* ---- type="auto" ---- */

function ScrollbarAuto(props: { p: ScrollAreaScrollbarProps; forceMount: true | undefined; dataState?: DataState }) {
  const p = props.p;
  const context = useScrollAreaContext("ScrollAreaScrollbar");
  const isHorizontal = p.orientation === "horizontal";
  const forceMount = props.forceMount;
  const visible = _regionState(() => signal(false));
  clientEffect(() => {
    const viewport = context.viewport();
    const content = context.content();
    // Radix `useDebounceCallback(…, 10)` shared by both observers.
    let timer = 0;
    const handleResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const vp = untrack(context.viewport);
        if (vp) {
          const isOverflowX = vp.offsetWidth < vp.scrollWidth;
          const isOverflowY = vp.offsetHeight < vp.scrollHeight;
          visible.set(isHorizontal ? isOverflowX : isOverflowY);
        }
      }, 10);
    };
    const stopViewport = observeResize(viewport, handleResize);
    const stopContent = observeResize(content, handleResize);
    return () => {
      window.clearTimeout(timer);
      stopViewport();
      stopContent();
    };
  });
  const presence = createPresence({ present: () => !!forceMount || visible(), node: scrollbarRef(context, p) });
  // The wrapper's `data-state` (hover) wins over the overflow one (Radix spreads the outer props last).
  const outer = props.dataState;
  return (
    <Show when={() => isPresent(presence())}>{() => <ScrollbarVisible p={p} dataState={outer ?? { get: () => (visible() ? "visible" : "hidden") }} />}</Show>
  );
}

/* ---- ScrollAreaScrollbarVisible + ScrollAreaScrollbarX / Y + ScrollAreaScrollbarImpl ---- */

const SCROLLBAR_KEYS = [
  "orientation",
  "forceMount",
  "children",
  "class",
  "style",
  "ref",
  "render",
  "onPointerDown",
  "onPointerMove",
  "onPointerUp",
  "onPointerEnter",
  "onPointerLeave",
] as const;

type PointerHandler = ((event: PointerEvent & { currentTarget: HTMLDivElement }) => void) | undefined;

function ScrollbarVisible(props: { p: ScrollAreaScrollbarProps; dataState: DataState; machine?: Signal<ScrollState> }) {
  const [local, rest] = splitProps(props.p as Record<string, unknown>, SCROLLBAR_KEYS) as unknown as [ScrollAreaScrollbarProps, DivAttributes];
  const context = useScrollAreaContext("ScrollAreaScrollbar");
  const orientation: ScrollAreaOrientation = local.orientation === "horizontal" ? "horizontal" : "vertical";
  const isHorizontal = orientation === "horizontal";
  const element = isHorizontal ? context.scrollbarX : context.scrollbarY;
  // Component-owned (`_regionState`): a scrollbar re-created on a resumed page keeps its measures and thumb.
  const sizes = _regionState(() => signal<Sizes>(EMPTY_SIZES));
  const thumb = _regionState(() => createRef<HTMLDivElement>());
  const pointerOffset = _regionState(() => ({ current: 0 }));
  // Radix `rectRef` / `prevWebkitUserSelectRef` (pointer drag on the track / thumb).
  const drag = _regionState(() => ({ rect: null as DOMRect | null, prevWebkitUserSelect: "" }));
  const hasThumb = computed(() => {
    const s = sizes();
    const ratio = getThumbRatio(s.viewport, s.content);
    return ratio > 0 && ratio < 1;
  });
  const scrollbarValue: ScrollbarContextValue = { isHorizontal, sizes, hasThumb, thumb, pointerOffset };
  const dir = context.dir;
  const machine = props.machine;
  const dataState = props.dataState;
  const onPointerDown = local.onPointerDown as PointerHandler;
  const onPointerMove = local.onPointerMove as PointerHandler;
  const onPointerUp = local.onPointerUp as PointerHandler;
  const onPointerEnter = local.onPointerEnter as PointerHandler;
  const onPointerLeave = local.onPointerLeave as PointerHandler;
  const ref = mergeRefValues(element, local.ref) as never;
  const cls = local.class ?? "rv-ScrollAreaScrollbar";
  const userStyle = local.style;
  const children = local.children;

  // Radix composes the element into the context (`onScrollbarXChange`): the Corner renders while both are mounted. A
  // flag, not the ref: on a resumed page the revived ref already holds the server element, the flag changes.
  const mounted = isHorizontal ? context.scrollbarXMounted : context.scrollbarYMounted;
  clientEffect(() => {
    mounted.set(!!element());
    return () => mounted.set(false);
  });
  // Wheel over the scrollbar scrolls the viewport: bound on the document, not passive, so it can stop the page scroll.
  clientEffect(() => {
    const scrollbar = element();
    const handleWheel = (event: WheelEvent) => {
      if (scrollbar?.contains(event.target as Node)) wheelScroll(event, context, isHorizontal, untrack(sizes));
    };
    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => document.removeEventListener("wheel", handleWheel, { passive: false } as EventListenerOptions);
  });
  // Update the thumb position when the sizes change.
  clientEffect(() => {
    sizes();
    untrack(() => thumbPositionChange(context, scrollbarValue));
  });
  // Re-measure when the scrollbar or the content resizes (Radix `useDebounceCallback(onResize, 10)`).
  clientEffect(() => {
    const scrollbar = element();
    const content = context.content();
    let timer = 0;
    const handleResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => measure(context, scrollbarValue, untrack(element)), 10);
    };
    const stopScrollbar = observeResize(scrollbar, handleResize);
    const stopContent = observeResize(content, handleResize);
    return () => {
      window.clearTimeout(timer);
      stopScrollbar();
      stopContent();
    };
  });

  const style = (): StyleObject => scrollbarStyle(isHorizontal, dir, sizes(), userStyle);

  if (local.render)
    return local.render(
      {
        "data-orientation": orientation,
        "data-state": () => dataState.get(),
        ...rest,
        ref,
        class: cls,
        style: () => style(),
        onPointerDown: (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
          onPointerDown?.(event);
          if (!event.defaultPrevented) scrollbarPointerDown(event, context, scrollbarValue, drag);
        },
        onPointerMove: (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
          onPointerMove?.(event);
          if (!event.defaultPrevented) dragScroll(event, context, scrollbarValue, drag);
        },
        onPointerUp: (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
          onPointerUp?.(event);
          if (!event.defaultPrevented) scrollbarPointerUp(event, context, drag);
        },
        onPointerEnter: (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
          onPointerEnter?.(event);
          if (!event.defaultPrevented && machine) sendScroll(machine, "POINTER_ENTER");
        },
        onPointerLeave: (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
          onPointerLeave?.(event);
          if (!event.defaultPrevented && machine) sendScroll(machine, "POINTER_LEAVE");
        },
        children: () => (
          <Provider token={ScrollbarContext} value={scrollbarValue}>
            {children}
          </Provider>
        ),
      } as never,
      undefined,
    );
  return (
    <div
      data-orientation={orientation}
      data-state={dataState.get()}
      {...rest}
      ref={ref}
      class={cls}
      style={style()}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) scrollbarPointerDown(event, context, scrollbarValue, drag);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!event.defaultPrevented) dragScroll(event, context, scrollbarValue, drag);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        if (!event.defaultPrevented) scrollbarPointerUp(event, context, drag);
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented && machine) sendScroll(machine, "POINTER_ENTER");
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        if (!event.defaultPrevented && machine) sendScroll(machine, "POINTER_LEAVE");
      }}
    >
      <Provider token={ScrollbarContext} value={scrollbarValue}>
        {children}
      </Provider>
    </div>
  );
}

/** Radix `ScrollAreaScrollbarX` / `Y` style: absolute along its edge, the thumb size as a CSS variable. */
function scrollbarStyle(isHorizontal: boolean, dir: ScrollAreaDirection, sizes: Sizes, userStyle: StyleObject | undefined): StyleObject {
  const thumbSize = getThumbSize(sizes) + "px";
  return isHorizontal
    ? {
        position: "absolute",
        bottom: 0,
        left: dir === "rtl" ? "var(--rv-scroll-area-corner-width)" : 0,
        right: dir === "ltr" ? "var(--rv-scroll-area-corner-width)" : 0,
        "--rv-scroll-area-thumb-width": thumbSize,
        ...userStyle,
      }
    : {
        position: "absolute",
        top: 0,
        right: dir === "ltr" ? 0 : undefined,
        left: dir === "rtl" ? 0 : undefined,
        bottom: "var(--rv-scroll-area-corner-height)",
        "--rv-scroll-area-thumb-height": thumbSize,
        ...userStyle,
      };
}

/** Radix `ScrollAreaScrollbarX` / `Y` `onResize`: scroll metrics of the viewport + the scrollbar's inner length. */
function measure(context: ScrollAreaContextValue, scrollbar: ScrollbarContextValue, element: HTMLDivElement | undefined): void {
  const viewport = untrack(context.viewport);
  if (!element || !viewport) return;
  const computedStyle = element.ownerDocument.defaultView!.getComputedStyle(element);
  scrollbar.sizes.set(
    scrollbar.isHorizontal
      ? {
          content: viewport.scrollWidth,
          viewport: viewport.offsetWidth,
          scrollbar: { size: element.clientWidth, paddingStart: toInt(computedStyle.paddingLeft), paddingEnd: toInt(computedStyle.paddingRight) },
        }
      : {
          content: viewport.scrollHeight,
          viewport: viewport.offsetHeight,
          scrollbar: { size: element.clientHeight, paddingStart: toInt(computedStyle.paddingTop), paddingEnd: toInt(computedStyle.paddingBottom) },
        },
  );
}

/** Radix `onThumbPositionChange` (ScrollbarVisible): move the thumb to the viewport's scroll offset. */
function thumbPositionChange(context: ScrollAreaContextValue, scrollbar: ScrollbarContextValue): void {
  const viewport = untrack(context.viewport);
  const thumb = untrack(scrollbar.thumb);
  if (!viewport || !thumb) return;
  const sizes = untrack(scrollbar.sizes);
  if (scrollbar.isHorizontal) {
    const offset = getThumbOffsetFromScroll(viewport.scrollLeft, sizes, context.dir);
    thumb.style.transform = `translate3d(${offset}px, 0, 0)`;
  } else {
    const offset = getThumbOffsetFromScroll(viewport.scrollTop, sizes);
    thumb.style.transform = `translate3d(0, ${offset}px, 0)`;
  }
}

/** Radix `ScrollAreaScrollbarX` / `Y` `onWheelScroll`. */
function wheelScroll(event: WheelEvent, context: ScrollAreaContextValue, isHorizontal: boolean, sizes: Sizes): void {
  const viewport = untrack(context.viewport);
  if (!viewport) return;
  const maxScrollPos = sizes.content - sizes.viewport;
  const scrollPos = isHorizontal ? viewport.scrollLeft + event.deltaX : viewport.scrollTop + event.deltaY;
  if (isHorizontal) viewport.scrollLeft = scrollPos;
  else viewport.scrollTop = scrollPos;
  // Prevent the window scroll when wheeling on the scrollbar.
  if (isScrollingWithinScrollbarBounds(scrollPos, maxScrollPos)) event.preventDefault();
}

/** Radix `handleDragScroll` → `onDragScroll` (ScrollbarX / Y → ScrollbarVisible). */
function dragScroll(event: PointerEvent, context: ScrollAreaContextValue, scrollbar: ScrollbarContextValue, drag: { rect: DOMRect | null }): void {
  const rect = drag.rect;
  if (!rect) return;
  const viewport = untrack(context.viewport);
  if (!viewport) return;
  const sizes = untrack(scrollbar.sizes);
  if (scrollbar.isHorizontal)
    viewport.scrollLeft = getScrollPositionFromPointer(event.clientX - rect.left, scrollbar.pointerOffset.current, sizes, context.dir);
  else viewport.scrollTop = getScrollPositionFromPointer(event.clientY - rect.top, scrollbar.pointerOffset.current, sizes);
}

function scrollbarPointerDown(
  event: PointerEvent & { currentTarget: HTMLDivElement },
  context: ScrollAreaContextValue,
  scrollbar: ScrollbarContextValue,
  drag: { rect: DOMRect | null; prevWebkitUserSelect: string },
): void {
  const mainPointer = 0;
  if (event.button !== mainPointer) return;
  const element = event.target as HTMLElement;
  element.setPointerCapture(event.pointerId);
  drag.rect = event.currentTarget.getBoundingClientRect();
  // Pointer capture doesn't prevent text selection in Safari: remove the selection while dragging.
  const body = element.ownerDocument.body;
  drag.prevWebkitUserSelect = body.style.webkitUserSelect;
  body.style.webkitUserSelect = "none";
  const viewport = untrack(context.viewport);
  if (viewport) viewport.style.scrollBehavior = "auto";
  dragScroll(event, context, scrollbar, drag);
}

function scrollbarPointerUp(event: PointerEvent, context: ScrollAreaContextValue, drag: { rect: DOMRect | null; prevWebkitUserSelect: string }): void {
  const element = event.target as HTMLElement;
  if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  element.ownerDocument.body.style.webkitUserSelect = drag.prevWebkitUserSelect;
  const viewport = untrack(context.viewport);
  if (viewport) viewport.style.scrollBehavior = "";
  drag.rect = null;
}

/* -------------------------------------------------------------------------------------------------
 * ScrollAreaThumb
 * -----------------------------------------------------------------------------------------------*/

export interface ScrollAreaThumbProps extends PartProps {
  /** Mount the thumb whatever the overflow (animation libraries). */
  forceMount?: true;
}

/** The thumb of a scrollbar (Radix `ScrollArea.Thumb`): rendered while the content overflows the viewport. */
export function ScrollAreaThumb(props: ScrollAreaThumbProps) {
  const scrollbar = useScrollbarContext("ScrollAreaThumb");
  const forceMount = props.forceMount;
  const hasThumb = scrollbar.hasThumb;
  const presence = createPresence({ present: () => !!forceMount || hasThumb(), node: scrollbar.thumb });
  return <Show when={() => isPresent(presence())}>{() => <ThumbImpl p={props} />}</Show>;
}

const THUMB_KEYS = ["forceMount", "children", "class", "style", "ref", "render", "onPointerDown", "onPointerUp"] as const;

function ThumbImpl(props: { p: ScrollAreaThumbProps }) {
  const [local, rest] = splitProps(props.p as Record<string, unknown>, THUMB_KEYS) as unknown as [ScrollAreaThumbProps, DivAttributes];
  const context = useScrollAreaContext("ScrollAreaThumb");
  const scrollbar = useScrollbarContext("ScrollAreaThumb");
  const ref = mergeRefValues(scrollbar.thumb, local.ref) as never;
  const cls = local.class ?? "rv-ScrollAreaThumb";
  const style = { width: "var(--rv-scroll-area-thumb-width)", height: "var(--rv-scroll-area-thumb-height)", ...local.style };
  const hasThumb = scrollbar.hasThumb;
  const pointerOffset = scrollbar.pointerOffset;
  const isHorizontal = scrollbar.isHorizontal;
  const onPointerDown = local.onPointerDown as PointerHandler;
  const onPointerUp = local.onPointerUp as PointerHandler;
  const children = local.children;

  // Only the native `scroll` event tells when a scroll starts / ends: while scrolling a rAF loop follows the scroll
  // position (no scroll-linked effects, https://developer.mozilla.org/en-US/docs/Mozilla/Performance/Scroll-linked_effects).
  clientEffect(() => {
    const viewport = context.viewport();
    if (!viewport) return;
    let removeUnlinkedScrollListener: (() => void) | undefined;
    let timer = 0;
    const onThumbPositionChange = () => thumbPositionChange(context, scrollbar);
    const handleScroll = () => {
      // Radix `useDebounceCallback(…, 100)`: stop the loop 100 ms after the last scroll event.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        removeUnlinkedScrollListener?.();
        removeUnlinkedScrollListener = undefined;
      }, 100);
      if (!removeUnlinkedScrollListener) {
        removeUnlinkedScrollListener = addUnlinkedScrollListener(viewport, onThumbPositionChange);
        onThumbPositionChange();
      }
    };
    untrack(onThumbPositionChange);
    viewport.addEventListener("scroll", handleScroll);
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      window.clearTimeout(timer);
      removeUnlinkedScrollListener?.();
    };
  });

  if (local.render)
    return local.render(
      {
        "data-state": () => (hasThumb() ? "visible" : "hidden"),
        ...rest,
        ref,
        class: cls,
        style,
        onPointerDown: (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
          onPointerDown?.(event);
          if (!event.defaultPrevented) thumbPointerDown(event, pointerOffset, isHorizontal);
        },
        onPointerUp: (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
          onPointerUp?.(event);
          if (!event.defaultPrevented) pointerOffset.current = 0;
        },
        children,
      } as never,
      undefined,
    );
  return (
    <div
      data-state={hasThumb() ? "visible" : "hidden"}
      {...rest}
      ref={ref}
      class={cls}
      style={style}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) thumbPointerDown(event, pointerOffset, isHorizontal);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        if (!event.defaultPrevented) pointerOffset.current = 0;
      }}
    >
      {children}
    </div>
  );
}

/** Radix Thumb `onPointerDownCapture` → `onThumbPointerDown`: where the pointer grabbed the thumb. */
function thumbPointerDown(event: PointerEvent, pointerOffset: { current: number }, isHorizontal: boolean): void {
  const thumbRect = (event.target as HTMLElement).getBoundingClientRect();
  pointerOffset.current = isHorizontal ? event.clientX - thumbRect.left : event.clientY - thumbRect.top;
}

/* -------------------------------------------------------------------------------------------------
 * ScrollAreaCorner
 * -----------------------------------------------------------------------------------------------*/

export interface ScrollAreaCornerProps extends PartProps {}

/** The corner where both scrollbars meet (Radix `ScrollArea.Corner`): rendered while both are, except for `type="scroll"`. */
export function ScrollAreaCorner(props: ScrollAreaCornerProps) {
  const context = useScrollAreaContext("ScrollAreaCorner");
  const type = context.type;
  const xMounted = context.scrollbarXMounted;
  const yMounted = context.scrollbarYMounted;
  return <Show when={() => type !== "scroll" && xMounted() && yMounted()}>{() => <CornerImpl p={props} />}</Show>;
}

const CORNER_KEYS = ["children", "class", "style", "ref", "render"] as const;

function CornerImpl(props: { p: ScrollAreaCornerProps }) {
  const [local, rest] = splitProps(props.p as Record<string, unknown>, CORNER_KEYS) as unknown as [ScrollAreaCornerProps, DivAttributes];
  const context = useScrollAreaContext("ScrollAreaCorner");
  const width = _regionState(() => signal(0));
  const height = _regionState(() => signal(0));
  clientEffect(() => {
    const scrollbarX = context.scrollbarX();
    return observeResize(scrollbarX, () => {
      const h = untrack(context.scrollbarX)?.offsetHeight || 0;
      context.cornerHeight.set(h);
      height.set(h);
    });
  });
  clientEffect(() => {
    const scrollbarY = context.scrollbarY();
    return observeResize(scrollbarY, () => {
      const w = untrack(context.scrollbarY)?.offsetWidth || 0;
      context.cornerWidth.set(w);
      width.set(w);
    });
  });
  // Reset the corner sizes when the corner unmounts (one scrollbar hidden): the CSS variables must not leave a gap
  // on the remaining scrollbar (radix-ui/primitives#2383).
  clientEffect(() => () => {
    context.cornerWidth.set(0);
    context.cornerHeight.set(0);
  });
  const dir = context.dir;
  const userStyle = local.style;
  const cls = local.class ?? "rv-ScrollAreaCorner";
  // `{ current }` / callback / `ref()` user refs (the runtime binds functions and `ref()` signals only).
  const ref = mergeRefValues(createRef<HTMLDivElement>(), local.ref) as never;
  const children = local.children;
  const render = local.render;
  const style = (): StyleObject => ({
    width: width(),
    height: height(),
    position: "absolute",
    right: dir === "ltr" ? 0 : undefined,
    left: dir === "rtl" ? 0 : undefined,
    bottom: 0,
    ...userStyle,
  });
  return (
    <Show when={() => !!(width() && height())}>
      {() =>
        render ? (
          render({ ...rest, ref, class: cls, style: () => style(), children } as never, undefined)
        ) : (
          <div {...rest} ref={ref} class={cls} style={style()}>
            {children}
          </div>
        )
      }
    </Show>
  );
}

/* -----------------------------------------------------------------------------------------------*/

function toInt(value?: string): number {
  return value ? parseInt(value, 10) : 0;
}

function getThumbRatio(viewportSize: number, contentSize: number): number {
  const ratio = viewportSize / contentSize;
  return isNaN(ratio) ? 0 : ratio;
}

function getThumbSize(sizes: Sizes): number {
  const ratio = getThumbRatio(sizes.viewport, sizes.content);
  const scrollbarPadding = sizes.scrollbar.paddingStart + sizes.scrollbar.paddingEnd;
  const thumbSize = (sizes.scrollbar.size - scrollbarPadding) * ratio;
  // Minimum of 18 matches the macOS minimum.
  return Math.max(thumbSize, 18);
}

function getScrollPositionFromPointer(pointerPos: number, pointerOffset: number, sizes: Sizes, dir: ScrollAreaDirection = "ltr"): number {
  const thumbSizePx = getThumbSize(sizes);
  const thumbCenter = thumbSizePx / 2;
  const offset = pointerOffset || thumbCenter;
  const thumbOffsetFromEnd = thumbSizePx - offset;
  const minPointerPos = sizes.scrollbar.paddingStart + offset;
  const maxPointerPos = sizes.scrollbar.size - sizes.scrollbar.paddingEnd - thumbOffsetFromEnd;
  const maxScrollPos = sizes.content - sizes.viewport;
  const scrollRange: [number, number] = dir === "ltr" ? [0, maxScrollPos] : [maxScrollPos * -1, 0];
  return linearScale([minPointerPos, maxPointerPos], scrollRange)(pointerPos);
}

function getThumbOffsetFromScroll(scrollPos: number, sizes: Sizes, dir: ScrollAreaDirection = "ltr"): number {
  const thumbSizePx = getThumbSize(sizes);
  const scrollbarPadding = sizes.scrollbar.paddingStart + sizes.scrollbar.paddingEnd;
  const scrollbar = sizes.scrollbar.size - scrollbarPadding;
  const maxScrollPos = sizes.content - sizes.viewport;
  const maxThumbPos = scrollbar - thumbSizePx;
  const scrollClampRange: [number, number] = dir === "ltr" ? [0, maxScrollPos] : [maxScrollPos * -1, 0];
  const scrollWithoutMomentum = clamp(scrollPos, scrollClampRange);
  return linearScale([0, maxScrollPos], [0, maxThumbPos])(scrollWithoutMomentum);
}

/** @radix-ui/number `clamp`. */
function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, value));
}

// https://github.com/tmcw-up-for-adoption/simple-linear-scale/blob/master/index.js
function linearScale(input: readonly [number, number], output: readonly [number, number]): (value: number) => number {
  return (value: number) => {
    if (input[0] === input[1] || output[0] === output[1]) return output[0];
    const ratio = (output[1] - output[0]) / (input[1] - input[0]);
    return output[0] + ratio * (value - input[0]);
  };
}

function isScrollingWithinScrollbarBounds(scrollPos: number, maxScrollPos: number): boolean {
  return scrollPos > 0 && scrollPos < maxScrollPos;
}

/* -----------------------------------------------------------------------------------------------*/

export {
  ScrollArea as Root,
  ScrollAreaViewport as Viewport,
  ScrollAreaContent as Content,
  ScrollAreaScrollbar as Scrollbar,
  ScrollAreaThumb as Thumb,
  ScrollAreaCorner as Corner,
};
