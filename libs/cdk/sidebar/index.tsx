// Ported from shadcn/ui Sidebar (apps/v4/registry/new-york-v4/ui/sidebar.tsx, apps/v4/registry/new-york-v4/hooks/use-mobile.ts;
// React Aria base apps/v4/registry/bases/aria/ui/sidebar.tsx), shadcn/ui 4.21.4, MIT, © 2023 shadcn.
// A composable, collapsible app sidebar: SidebarProvider (state, Cmd/Ctrl+B, `sidebar_state` cookie, mobile
// detection) > Sidebar (desktop panel; a modal sheet on mobile) + SidebarInset / SidebarTrigger, and the
// structural parts (header / footer / content / groups / menus / sub menus).
// Rivet:
// - headless: every part renders the same element and `data-slot` / `data-sidebar` / `data-*` attributes as
//   upstream, with a default `rv-Sidebar*` class instead of the Tailwind classes; the look (widths, collapse
//   transitions, offcanvas / icon modes) is CSS on those attributes (`@rivetjs/cdk/theme.css`,
//   `@rivetjs/ui/sidebar`). CSS variables `--sidebar-width` / `--sidebar-width-icon` on the provider,
//   `--sidebar-width-mobile` on the sheet.
// - state = `./state.ts` (signals + `controllable`): `open` takes a value, a two-way Signal or an accessor;
//   `useSidebar()` returns accessors (`state()`, `open()`, `openMobile()`, `isMobile()`) + setters.
// - nothing runs at load (a resumed sidebar page stays cold): the keyboard shortcut is a delegated `keydown` on
//   the wrapper (works cold, while focus is inside the wrapper) + a window listener attached once the runtime runs
//   (`preload: "interaction"`); `isMobile` (upstream `useIsMobile`, `false` on the server) is re-read on every
//   toggle and by a `media:` listener attached the same way; tooltips / `useSidebar().isMobile()` read the viewport
//   at call time. Before any interaction the mobile / desktop split is CSS (desktop root hidden below 768 px).
// - `asChild` → `render` (cdk DOMRenderProps); `Slot` merging → spread the received props.
// - mobile: Sheet → cdk ModalOverlay + Modal + Dialog on the shared div overlay layer (dismissable, Escape),
//   swipe-to-dismiss `sidebarSheetMotion` (./sheet-motion.ts, `@rivetjs/cdk/motion` physics).
// - Button-like parts follow the React Aria base: SidebarTrigger / SidebarMenuAction = cdk Button,
//   SidebarMenuButton / SidebarMenuSubButton = cdk Link with `href`, else cdk Button; tooltip = cdk
//   TooltipTrigger (disabled unless collapsed and not mobile) + Tooltip `placement="right"`, delay 0
//   (new-york `TooltipProvider delayDuration={0}`).
// Rivet extensions (feature set inspired by HeroUI Pro's public Sidebar docs; independent implementation), shadcn API kept:
// - provider `toggleShortcut` / `reduceMotion` / `closeMobileOnAction` / `navigate` (+ `useHref`: a cdk RouterProvider
//   for the subtree; default = native links, which `@rivetjs/router` routes client-side when a route matches);
// - tree menus: `expandable` (or `defaultExpanded` / `isExpanded` / `onExpandedChange`) on SidebarMenuItem /
//   SidebarMenuSubItem renders a cdk Disclosure (`li`), `SidebarMenuTrigger` (slot="trigger" menu button) +
//   `SidebarMenuIndicator`, the item's SidebarMenuSub becomes the DisclosurePanel's list (APG disclosure navigation);
//   `SidebarMenu showGuideLines` (true | "hover" | false → `data-guide-lines`), menu / group options context;
// - menu buttons: `isCurrent` (aria-current="page"), `forceReload` (`data-rivet-reload`, native router), external
//   http(s) hrefs open in a new tab, `closeMobileOnAction`; `SidebarMenuActions` (several actions);
// - `Sidebar backdrop` (mobile underlay `data-backdrop`), `SidebarPages` / `SidebarPage` (./pages.tsx).
// Deviations: `data-active` / `data-show-on-hover` are `"true"` or absent (React writes `"false"` too);
// `SidebarMenuAction` writes `data-show-on-hover` and `SidebarMenuButton` `data-variant` (upstream: Tailwind
// classes) so CSS can key on them; the desktop root stays in the DOM on mobile (empty, CSS-hidden) so `SidebarInset`'s sibling selectors keep working.
import { createContext, provide, signal, useContext, type Signal } from "@rivetjs/reactivity";
import { Show, clientEffect, clientEvent, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { visuallyHidden } from "../a11y/index.ts";
import { Button, type ButtonProps } from "../button/index.tsx";
import { Link, type LinkProps } from "../link/index.tsx";
import { Input, type InputProps } from "../input/index.tsx";
import { Separator, type SeparatorProps } from "../separator/index.tsx";
import { Dialog } from "../dialog/index.tsx";
import { Modal, ModalOverlay } from "../modal/index.tsx";
import { Tooltip, TooltipTrigger, type TooltipProps } from "../tooltip/index.tsx";
import { Disclosure, DisclosurePanel } from "../disclosure/index.tsx";
import { RouterContext, createRouter, type Href, type RouterOptions } from "../utils/links.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { resumedId } from "../utils/id.ts";
import type { GlobalDOMAttributes } from "../utils/dom-props.ts";
import type { DOMRenderProps } from "../utils/render.ts";
import { Provider, renderProps, type ClassNameOrFunction, type RefValue, type StyleObject } from "../slots/index.tsx";
import { sidebarSheetMotion } from "./sheet-motion.ts";
import {
  createSidebarResizeState,
  sidebarBoundPx,
  sidebarResizeKeyDown,
  sidebarResizePointerDown,
  sidebarResizePointerMove,
  sidebarResizePointerUp,
  sidebarResizeReset,
  sidebarResizeSync,
  sidebarWidthCss,
  sidebarWidthNow,
  type SidebarResizeProps,
  type SidebarResizeState,
} from "./resize.ts";
import {
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_WIDTH_MOBILE,
  closeSidebarMobileOnAction,
  createSidebarState,
  setSidebarOpen,
  setSidebarOpenMobile,
  sidebarShortcutKeyDown,
  sidebarReducedMotion,
  sidebarStateName,
  sidebarViewportIsMobile,
  toggleSidebar,
  updateSidebarIsMobile,
  SidebarContext,
  SidebarMenuOptionsContext,
  type SidebarState,
  type SidebarStateProps,
} from "./state.ts";

export * from "./state.ts";
export { sidebarSheetMotion, type SidebarSheetMotionOptions } from "./sheet-motion.ts";
export * from "./resize.ts";
export {
  SidebarPage,
  SidebarPages,
  SidebarPagesContext,
  setSidebarPage,
  sidebarPagesValue,
  useSidebarPages,
  type SidebarPageProps,
  type SidebarPagesContextValue,
  type SidebarPagesProps,
  type SidebarPagesState,
} from "./pages.tsx";

const NONE = {};

/** Props shared by the structural parts (upstream `React.ComponentProps<tag>`). */
export interface SidebarPartProps<E extends Element = HTMLElement> extends GlobalDOMAttributes<E>, DOMRenderProps<any, undefined> {
  /** The CSS class (a string, or a function of `{ defaultClassName }`; called in a binding). */
  class?: ClassNameOrFunction<{}>;
  style?: StyleObject;
  id?: string;
  role?: string;
  title?: string;
  children?: Content;
  ref?: RefValue<E>;
  [attribute: `aria-${string}`]: unknown;
}

/** `useSidebar()` (upstream `SidebarContextProps`): values are accessors. */
export interface SidebarContextValue {
  /** `"expanded"` / `"collapsed"`. */
  state: () => "expanded" | "collapsed";
  open: () => boolean;
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  openMobile: () => boolean;
  setOpenMobile: (open: boolean | ((open: boolean) => boolean)) => void;
  isMobile: () => boolean;
  toggleSidebar: () => void;
}

/** Rivet: whether the nearest menu item is an expandable tree item (its SidebarMenuSub is the panel). */
const SidebarItemContext = createContext<boolean>(false);

function sidebarState(): SidebarState {
  const state = useContext(SidebarContext);
  if (!state) throw new Error("useSidebar must be used within a SidebarProvider.");
  return state;
}

/** Upstream `useSidebar`: state accessors + setters of the nearest SidebarProvider (throws outside one). */
export function useSidebar(): SidebarContextValue {
  const s = sidebarState();
  return {
    state: () => sidebarStateName(s),
    open: () => s.open(),
    setOpen: (open: boolean | ((open: boolean) => boolean)) => setSidebarOpen(s, open),
    openMobile: () => s.openMobile(),
    setOpenMobile: (open: boolean | ((open: boolean) => boolean)) => setSidebarOpenMobile(s, open),
    // Tracks the signal (media listener), answers from the viewport (nothing reads it at load).
    isMobile: () => (s.isMobile(), sidebarViewportIsMobile()),
    toggleSidebar: () => toggleSidebar(s),
  };
}

// =================================================================================================
// SidebarProvider
// =================================================================================================

export interface SidebarProviderProps extends SidebarStateProps, SidebarPartProps<HTMLDivElement> {
  /** Called for every `keydown` inside the wrapper, before the toggle shortcut check. */
  onKeyDown?: (event: KeyboardEvent) => void;
  /**
   * Rivet: client-side navigation for the sidebar's links (a cdk `RouterProvider` for the subtree; an inline arrow).
   * Without it links are native: `@rivetjs/router` routes them client-side when a route matches.
   */
  navigate?: (href: Href, routerOptions: RouterOptions) => void;
  /** Rivet: maps a router href to the DOM `href` (with `navigate`). */
  useHref?: (href: Href) => string;
}

/** Provides the sidebar state; wraps the app (`data-slot="sidebar-wrapper"`). */
export function SidebarProvider(props: SidebarProviderProps) {
  const {
    open,
    defaultOpen,
    onOpenChange,
    toggleShortcut,
    reduceMotion,
    closeMobileOnAction,
    side,
    variant,
    collapsible,
    navigate,
    useHref,
    class: cls,
    style,
    children,
    render,
    ref,
    onKeyDown,
    ...rest
  } = props;
  const state = createSidebarState({
    open,
    defaultOpen,
    onOpenChange,
    toggleShortcut,
    reduceMotion,
    closeMobileOnAction,
    side,
    variant,
    collapsible,
  });
  const reduce = dataBool(!!reduceMotion);
  // use-mobile.ts: every media query change, once the runtime runs (no boot at load; toggles re-read the width).
  // A literal: `media:` + MOBILE_QUERY. `standalone: false`: these listeners never boot the page (a standalone
  // `clientEvent` sets the idle trigger on the derived server, TOAST-ACTIVE).
  clientEvent("media:(max-width: 767px)", "change", () => updateSidebarIsMobile(state), { preload: "interaction", standalone: false });
  // Adds a keyboard shortcut to toggle the sidebar: window-wide once the runtime runs; cold, the wrapper's
  // delegated keydown below (an event is handled once).
  clientEvent(window, "keydown", (event: KeyboardEvent) => sidebarShortcutKeyDown(event, state), { preload: "interaction", standalone: false });
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarProvider" });
  // `navigate`: a router for the subtree (cdk Link / menu buttons); default = the native router.
  // Built in the body (not inside the closure): the router object is a capture of `content`, its `navigate` the caller's.
  const router = navigate ? createRouter(navigate, useHref) : undefined;
  const content = () => (router ? provide(RouterContext, router, () => rp.children()) : rp.children());
  const wrapperStyle = { "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON, ...style };
  if (render) {
    const attrs = {
      ...rest,
      ref,
      "data-slot": "sidebar-wrapper",
      class: () => rp.class(),
      style: wrapperStyle,
      "data-reduce-motion": reduce,
      onKeyDown: (event: KeyboardEvent) => {
        onKeyDown?.(event);
        sidebarShortcutKeyDown(event, state);
      },
      children: () => <Provider values={[[SidebarContext, state]]}>{() => content()}</Provider>,
    };
    return render(attrs as never, undefined);
  }
  return (
    <div
      {...rest}
      ref={ref as never}
      data-slot="sidebar-wrapper"
      class={rp.class()}
      style={wrapperStyle}
      data-reduce-motion={reduce}
      preload="visible"
      onKeyDown={(event: KeyboardEvent) => {
        onKeyDown?.(event);
        sidebarShortcutKeyDown(event, state);
      }}
    >
      {provide(SidebarContext, state, () => content())}
    </div>
  );
}

// =================================================================================================
// Sidebar
// =================================================================================================

export interface SidebarProps extends SidebarPartProps<HTMLDivElement>, SidebarResizeProps {
  /** @default the provider's `side`, else "left" */
  side?: MaybeAccessor<"left" | "right">;
  /** @default the provider's `variant`, else "sidebar" */
  variant?: MaybeAccessor<"sidebar" | "floating" | "inset">;
  /** `none` is read once (it picks the element). @default the provider's `collapsible`, else "offcanvas" */
  collapsible?: MaybeAccessor<"offcanvas" | "icon" | "none">;
  /** Class of the desktop root (`data-slot="sidebar"`, carries `data-state` / `data-collapsible` / `data-variant` / `data-side`). @default "rv-Sidebar" */
  rootClass?: string;
  /** Class of the gap element that reserves the width in the layout. @default "rv-Sidebar-gap" */
  gapClass?: string;
  /** Class of the inner panel (`data-sidebar="sidebar"`). @default "rv-Sidebar-inner" */
  innerClass?: string;
  /** Mobile: class of the overlay underlay. @default "rv-Sidebar-overlay" */
  overlayClass?: string;
  /** Mobile: class of the sheet (`data-mobile="true"`). @default "rv-Sidebar-sheet" */
  sheetClass?: string;
  /** Mobile: class of the sheet's dialog (holds the content). @default "rv-Sidebar-dialog" */
  dialogClass?: string;
  /** Rivet: mobile sheet underlay look (`data-backdrop` on the overlay). @default "blur" */
  backdrop?: "blur" | "opaque" | "transparent";
  /**
   * Rivet: a drag handle on the panel's inner edge resizes the desktop sidebar (`role="separator"`; `width` /
   * `defaultWidth` / `minWidth` / `maxWidth` / `onWidthChange` / `onWidthChangeEnd` / `collapseBelowMin` / `resizeStep`).
   * Not with `collapsible="none"`. @default false
   */
  resizable?: boolean;
  /** Rivet: class of the resize handle. @default "rv-SidebarResizeHandle" */
  resizeHandleClass?: string;
  /** Rivet: accessible name of the resize handle. @default "Resize sidebar" */
  resizeHandleLabel?: string;
}

/**
 * The sidebar panel. `class`, `style` and the DOM props land on the desktop container
 * (`data-slot="sidebar-container"`) and on the mobile sheet; `collapsible="none"` renders one plain panel.
 */
export function Sidebar(props: SidebarProps) {
  const s = sidebarState();
  const {
    side = s.side ?? "left",
    variant = s.variant ?? "sidebar",
    collapsible = s.collapsible ?? "offcanvas",
    class: cls,
    style,
    children,
    render,
    ref,
    rootClass,
    gapClass,
    innerClass,
    overlayClass,
    sheetClass,
    dialogClass,
    backdrop = "blur",
    resizable,
    width,
    defaultWidth,
    onWidthChange,
    onWidthChangeEnd,
    minWidth,
    maxWidth,
    collapseBelowMin,
    resizeStep,
    resizeHandleClass,
    resizeHandleLabel,
    ...rest
  } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: collapsible === "none" ? "rv-Sidebar" : "rv-Sidebar-container" });
  if (read(collapsible) === "none") {
    if (render) return render({ ...rest, ref, "data-slot": "sidebar", class: () => rp.class(), style, children: () => rp.children() } as never, undefined);
    return (
      <div {...rest} ref={ref as never} data-slot="sidebar" class={rp.class()} style={style}>
        {rp.children()}
      </div>
    );
  }
  const sheet = { side, children, overlayClass, sheetClass, dialogClass, style, rest, backdrop };
  // Rivet `resizable`: the width is `--sidebar-width` on the root (the gap + container read it), unset = the provider's.
  const rs: SidebarResizeState | null = resizable
    ? createSidebarResizeState({ width, defaultWidth, onWidthChange, onWidthChangeEnd, minWidth, maxWidth, collapseBelowMin, resizeStep })
    : null;
  const handle = { state: s, rs: rs!, class: resizeHandleClass, label: resizeHandleLabel };
  return (
    <div
      class={rootClass ?? "rv-Sidebar"}
      style={rs ? { "--sidebar-width": sidebarWidthCss(rs.control.value()) } : undefined}
      data-state={sidebarStateName(s)}
      data-collapsible={s.open() ? "" : read(collapsible)}
      data-variant={read(variant)}
      data-side={read(side)}
      data-slot="sidebar"
    >
      <Show when={() => !s.isMobile()} fallback={() => <SidebarSheet state={s} {...sheet} />}>
        {() => (
          <>
            {/* This is what handles the sidebar gap on desktop */}
            <div data-slot="sidebar-gap" class={gapClass ?? "rv-Sidebar-gap"} />
            {render ? (
              render(
                {
                  ...rest,
                  ref,
                  "data-slot": "sidebar-container",
                  "data-side": () => read(side),
                  class: () => rp.class(),
                  style,
                  children: () => (
                    <>
                      <div data-sidebar="sidebar" data-slot="sidebar-inner" class={innerClass ?? "rv-Sidebar-inner"}>
                        {rp.children()}
                      </div>
                      {rs ? <SidebarResizeHandle {...handle} /> : null}
                    </>
                  ),
                } as never,
                undefined,
              )
            ) : (
              <div {...rest} ref={ref as never} data-slot="sidebar-container" data-side={read(side)} class={rp.class()} style={style}>
                <div data-sidebar="sidebar" data-slot="sidebar-inner" class={innerClass ?? "rv-Sidebar-inner"}>
                  {rp.children()}
                </div>
                {rs ? <SidebarResizeHandle {...handle} /> : null}
              </div>
            )}
          </>
        )}
      </Show>
    </div>
  );
}

interface SidebarResizeHandleProps {
  state: SidebarState;
  rs: SidebarResizeState;
  class: string | undefined;
  label: string | undefined;
}

/** Behaviour-critical: no browser panning / scrolling while dragging the handle. */
const RESIZE_HANDLE_STYLE = Object.freeze({ touchAction: "none" });

/**
 * Rivet `resizable`: the WAI-ARIA window splitter on the panel's inner edge (`./resize.ts`). Pointer drag (captured),
 * arrows / Home / End / Enter, double-click resets; nothing runs before the first interaction.
 */
function SidebarResizeHandle(props: SidebarResizeHandleProps) {
  const { state, rs, class: cls, label } = props;
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label ?? "Resize sidebar"}
      aria-valuenow={sidebarWidthNow(rs)}
      aria-valuemin={sidebarBoundPx(rs.min)}
      aria-valuemax={sidebarBoundPx(rs.max)}
      data-sidebar="resize-handle"
      data-slot="sidebar-resize-handle"
      class={cls ?? "rv-SidebarResizeHandle"}
      style={RESIZE_HANDLE_STYLE}
      onPointerDown={(event: PointerEvent) => sidebarResizePointerDown(event, state, rs)}
      onPointerMove={(event: PointerEvent) => sidebarResizePointerMove(event, state, rs)}
      onPointerUp={(event: PointerEvent) => sidebarResizePointerUp(event, rs)}
      onPointerCancel={(event: PointerEvent) => sidebarResizePointerUp(event, rs)}
      onDblClick={(event: MouseEvent) => sidebarResizeReset(event, state, rs)}
      onKeyDown={(event: KeyboardEvent) => sidebarResizeKeyDown(event, state, rs)}
      onFocus={(event: FocusEvent) => sidebarResizeSync(event, rs)}
    />
  );
}

interface SidebarSheetProps {
  state: SidebarState;
  side: MaybeAccessor<"left" | "right">;
  children?: Content;
  overlayClass?: string;
  sheetClass?: string;
  dialogClass?: string;
  style?: StyleObject;
  rest: Record<string, unknown>;
  backdrop: "blur" | "opaque" | "transparent";
}

/** Mobile: upstream `<Sheet>` = ModalOverlay + Modal + Dialog on the shared overlay layer. */
function SidebarSheet(props: SidebarSheetProps) {
  const { state, side, children, overlayClass, sheetClass, dialogClass, style, rest, backdrop } = props;
  const sheetRef = createRef<HTMLDivElement>();
  const titleId = resumedId();
  const descriptionId = resumedId();
  // Swipe-to-dismiss (./sheet-motion.ts) while the sheet is open.
  clientEffect(() => {
    const el = sheetRef();
    if (!el || !state.openMobile()) return;
    return sidebarSheetMotion(el, { side: read(side), close: () => setSidebarOpenMobile(state, false), reduceMotion: () => state.reduceMotion });
  });
  const sheetStyle = { "--sidebar-width": `var(--sidebar-width-mobile, ${SIDEBAR_WIDTH_MOBILE})`, ...style };
  return (
    <ModalOverlay
      isOpen={state.openMobile}
      isDismissable
      class={overlayClass ?? "rv-Sidebar-overlay"}
      data-side={read(side)}
      data-backdrop={backdrop}
      data-reduce-motion={dataBool(state.reduceMotion)}
    >
      <Modal
        {...rest}
        ref={sheetRef}
        class={sheetClass ?? "rv-Sidebar-sheet"}
        style={sheetStyle}
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        data-side={read(side)}
        data-reduce-motion={dataBool(state.reduceMotion)}
      >
        {() => (
          <Dialog class={dialogClass ?? "rv-Sidebar-dialog"} aria-labelledby={titleId} aria-describedby={descriptionId}>
            <div data-slot="sheet-header" style={visuallyHidden}>
              <h2 id={titleId}>Sidebar</h2>
              <p id={descriptionId}>Displays the mobile sidebar.</p>
            </div>
            <div data-slot="sidebar-sheet-inner" class="rv-Sidebar-sheet-inner">
              {children}
            </div>
          </Dialog>
        )}
      </Modal>
    </ModalOverlay>
  );
}

// =================================================================================================
// SidebarTrigger / SidebarRail / SidebarInset
// =================================================================================================

/** Children = static content (the icon); no render function: the label follows them. */
export type SidebarTriggerProps = Omit<ButtonProps, "children"> & { children?: Content };

/**
 * Toggles the sidebar (desktop) or the mobile sheet. The visually hidden "Toggle Sidebar" label is always rendered after
 * `children` (shadcn renders its icon + the `sr-only` label and ignores children; headless here, so `children` = the
 * icon); pass `aria-label` to rename it.
 */
export function SidebarTrigger(props: SidebarTriggerProps) {
  const s = sidebarState();
  const { onPress, class: cls, children, ...rest } = props;
  return (
    <Button
      {...rest}
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      class={cls ?? "rv-SidebarTrigger"}
      onPress={(event) => {
        onPress?.(event);
        toggleSidebar(s);
      }}
    >
      {children}
      <span style={visuallyHidden}>Toggle Sidebar</span>
    </Button>
  );
}

export interface SidebarRailProps extends SidebarPartProps<HTMLButtonElement> {}

/** The thin rail along the sidebar edge: click toggles (not in the tab order, as upstream). */
export function SidebarRail(props: SidebarRailProps) {
  const s = sidebarState();
  const { class: cls, style, render, ref, onClick, children, ...rest } = props;
  const rp = renderProps({ class: cls, values: NONE, defaultClassName: "rv-SidebarRail" });
  if (render)
    return render(
      {
        ...rest,
        ref,
        "data-sidebar": "rail",
        "data-slot": "sidebar-rail",
        "aria-label": "Toggle Sidebar",
        tabindex: -1,
        title: "Toggle Sidebar",
        class: () => rp.class(),
        style,
        onClick: (event: MouseEvent) => {
          toggleSidebar(s);
          onClick?.(event as never);
        },
        children,
      } as never,
      undefined,
    );
  return (
    <button
      {...rest}
      ref={ref as never}
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      title="Toggle Sidebar"
      class={rp.class()}
      style={style}
      onClick={(event) => {
        toggleSidebar(s);
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}

export interface SidebarInsetProps extends SidebarPartProps<HTMLElement> {}

/** The main content next to an `inset` sidebar (`<main>`). */
export function SidebarInset(props: SidebarInsetProps) {
  const { class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarInset" });
  if (render) return render({ ...rest, ref, "data-slot": "sidebar-inset", class: () => rp.class(), style, children: () => rp.children() } as never, undefined);
  return (
    <main {...rest} ref={ref as never} data-slot="sidebar-inset" class={rp.class()} style={style}>
      {rp.children()}
    </main>
  );
}

// =================================================================================================
// SidebarInput / SidebarSeparator
// =================================================================================================

export type SidebarInputProps = InputProps;

/** A cdk Input inside the sidebar (`data-sidebar="input"`). */
export function SidebarInput(props: SidebarInputProps) {
  const { class: cls, ...rest } = props;
  return <Input {...(rest as {})} {...{ "data-slot": "sidebar-input", "data-sidebar": "input" }} class={cls ?? "rv-SidebarInput"} />;
}

export type SidebarSeparatorProps = SeparatorProps;

/** A cdk Separator inside the sidebar (`data-sidebar="separator"`). */
export function SidebarSeparator(props: SidebarSeparatorProps) {
  const { class: cls, ...rest } = props;
  return <Separator {...rest} data-slot="sidebar-separator" data-sidebar="separator" class={cls ?? "rv-SidebarSeparator"} />;
}

// =================================================================================================
// Structural parts
// =================================================================================================

export type SidebarHeaderProps = SidebarPartProps<HTMLDivElement>;
/** Top of the sidebar (`data-sidebar="header"`). */
export function SidebarHeader(props: SidebarHeaderProps) {
  const { class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarHeader" });
  if (render)
    return render(
      { ...rest, ref, "data-slot": "sidebar-header", "data-sidebar": "header", class: () => rp.class(), style, children: () => rp.children() } as never,
      undefined,
    );
  return (
    <div {...rest} ref={ref as never} data-slot="sidebar-header" data-sidebar="header" class={rp.class()} style={style}>
      {rp.children()}
    </div>
  );
}

export type SidebarFooterProps = SidebarPartProps<HTMLDivElement>;
/** Bottom of the sidebar (`data-sidebar="footer"`). */
export function SidebarFooter(props: SidebarFooterProps) {
  const { class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarFooter" });
  if (render)
    return render(
      { ...rest, ref, "data-slot": "sidebar-footer", "data-sidebar": "footer", class: () => rp.class(), style, children: () => rp.children() } as never,
      undefined,
    );
  return (
    <div {...rest} ref={ref as never} data-slot="sidebar-footer" data-sidebar="footer" class={rp.class()} style={style}>
      {rp.children()}
    </div>
  );
}

export type SidebarContentProps = SidebarPartProps<HTMLDivElement>;
/** The scrollable middle of the sidebar (`data-sidebar="content"`). */
export function SidebarContent(props: SidebarContentProps) {
  const { class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarContent" });
  if (render)
    return render(
      { ...rest, ref, "data-slot": "sidebar-content", "data-sidebar": "content", class: () => rp.class(), style, children: () => rp.children() } as never,
      undefined,
    );
  return (
    <div {...rest} ref={ref as never} data-slot="sidebar-content" data-sidebar="content" class={rp.class()} style={style}>
      {rp.children()}
    </div>
  );
}

export interface SidebarGroupProps extends SidebarPartProps<HTMLDivElement> {
  /** Rivet: close the mobile sheet when a menu button in this group is pressed. @default inherited (provider: true) */
  closeMobileOnAction?: boolean;
}
/** A section of the sidebar (`data-sidebar="group"`). */
export function SidebarGroup(props: SidebarGroupProps) {
  const { closeMobileOnAction, class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarGroup" });
  // Options for the menus inside (only when set: the default markup has no provider).
  const options = closeMobileOnAction === undefined ? null : { ...useContext(SidebarMenuOptionsContext), closeMobileOnAction };
  if (render)
    return render(
      {
        ...rest,
        ref,
        "data-slot": "sidebar-group",
        "data-sidebar": "group",
        class: () => rp.class(),
        style,
        children: () => (options ? <Provider values={[[SidebarMenuOptionsContext, options]]}>{() => rp.children()}</Provider> : rp.children()),
      } as never,
      undefined,
    );
  return (
    <div {...rest} ref={ref as never} data-slot="sidebar-group" data-sidebar="group" class={rp.class()} style={style}>
      {options ? provide(SidebarMenuOptionsContext, options, () => rp.children()) : rp.children()}
    </div>
  );
}

export type SidebarGroupLabelProps = SidebarPartProps<HTMLDivElement>;
/** The label of a group (`div`; `render` replaces upstream `asChild`, e.g. a Disclosure trigger Button). */
export function SidebarGroupLabel(props: SidebarGroupLabelProps) {
  const { class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarGroupLabel" });
  if (render)
    return render(
      {
        ...rest,
        ref,
        "data-slot": "sidebar-group-label",
        "data-sidebar": "group-label",
        class: () => rp.class(),
        style,
        children: () => rp.children(),
      } as never,
      undefined,
    );
  return (
    <div {...rest} ref={ref as never} data-slot="sidebar-group-label" data-sidebar="group-label" class={rp.class()} style={style}>
      {rp.children()}
    </div>
  );
}

export type SidebarGroupActionProps = SidebarPartProps<HTMLButtonElement>;
/** An action button in a group header (native `button`, as the React Aria base). */
export function SidebarGroupAction(props: SidebarGroupActionProps) {
  const { class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarGroupAction" });
  if (render)
    return render(
      {
        ...rest,
        ref,
        "data-slot": "sidebar-group-action",
        "data-sidebar": "group-action",
        class: () => rp.class(),
        style,
        children: () => rp.children(),
      } as never,
      undefined,
    );
  return (
    <button {...rest} ref={ref as never} type="button" data-slot="sidebar-group-action" data-sidebar="group-action" class={rp.class()} style={style}>
      {rp.children()}
    </button>
  );
}

export type SidebarGroupContentProps = SidebarPartProps<HTMLDivElement>;
/** The content of a group (`data-sidebar="group-content"`). */
export function SidebarGroupContent(props: SidebarGroupContentProps) {
  const { class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarGroupContent" });
  if (render)
    return render(
      {
        ...rest,
        ref,
        "data-slot": "sidebar-group-content",
        "data-sidebar": "group-content",
        class: () => rp.class(),
        style,
        children: () => rp.children(),
      } as never,
      undefined,
    );
  return (
    <div {...rest} ref={ref as never} data-slot="sidebar-group-content" data-sidebar="group-content" class={rp.class()} style={style}>
      {rp.children()}
    </div>
  );
}

export interface SidebarMenuProps extends SidebarPartProps<HTMLUListElement> {
  /**
   * Rivet: the guide line along nested sub menus — always (`true`), only while the menu is hovered / focused
   * (`"hover"`) or never (`false`); `data-guide-lines="hover" | "none"` (absent for `true`). @default true
   */
  showGuideLines?: boolean | "hover";
  /** Rivet: close the mobile sheet when a menu button in this menu is pressed. @default inherited (group / provider) */
  closeMobileOnAction?: boolean;
  /** Rivet: no sub menu / indicator / pages animation in this menu (`data-reduce-motion`). @default inherited (provider) */
  reduceMotion?: boolean;
}
/** A menu list (`ul`, as new-york). */
export function SidebarMenu(props: SidebarMenuProps) {
  const { showGuideLines = true, closeMobileOnAction, reduceMotion, class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarMenu" });
  const guideLines = showGuideLines === true ? undefined : showGuideLines === "hover" ? "hover" : "none";
  const motion = reduceMotion === undefined ? undefined : String(reduceMotion);
  const options =
    closeMobileOnAction === undefined && reduceMotion === undefined
      ? null
      : {
          ...useContext(SidebarMenuOptionsContext),
          ...(closeMobileOnAction === undefined ? {} : { closeMobileOnAction }),
          ...(reduceMotion === undefined ? {} : { reduceMotion }),
        };
  if (render)
    return render(
      {
        ...rest,
        ref,
        "data-slot": "sidebar-menu",
        "data-sidebar": "menu",
        "data-guide-lines": guideLines,
        "data-reduce-motion": motion,
        class: () => rp.class(),
        style,
        children: () => (options ? <Provider values={[[SidebarMenuOptionsContext, options]]}>{() => rp.children()}</Provider> : rp.children()),
      } as never,
      undefined,
    );
  return (
    <ul
      {...rest}
      ref={ref as never}
      data-slot="sidebar-menu"
      data-sidebar="menu"
      data-guide-lines={guideLines}
      data-reduce-motion={motion}
      class={rp.class()}
      style={style}
    >
      {options ? provide(SidebarMenuOptionsContext, options, () => rp.children()) : rp.children()}
    </ul>
  );
}

/** Rivet: tree items — an expandable SidebarMenuItem / SidebarMenuSubItem is a cdk Disclosure. */
export interface SidebarExpandableProps {
  /** Renders the item as an expandable tree node (cdk Disclosure; implied by the props below). @default false */
  expandable?: boolean;
  /** Expanded at first (uncontrolled). @default false */
  defaultExpanded?: boolean;
  /** Expanded (controlled): a plain value or a two-way Signal. */
  isExpanded?: boolean | Signal<boolean>;
  /** Called when the item expands / collapses. */
  onExpandedChange?: (isExpanded: boolean) => void;
  /** Disables the trigger. */
  isDisabled?: boolean;
}

const isExpandable = (p: SidebarExpandableProps): boolean =>
  !!p.expandable || p.defaultExpanded !== undefined || p.isExpanded !== undefined || p.onExpandedChange !== undefined;

interface ExpandableItemProps extends SidebarExpandableProps {
  slot: "sidebar-menu-item" | "sidebar-menu-sub-item";
  part: "menu-item" | "menu-sub-item";
  defaultClassName: string;
  cls: ClassNameOrFunction<{}> | undefined;
  style?: StyleObject;
  children?: Content;
  ref?: RefValue<HTMLLIElement>;
  rest: Record<string, unknown>;
}

/** An expandable item: cdk Disclosure rendered as the `li` (`data-expanded`), its sub menu = the panel. */
function SidebarExpandableItem(props: ExpandableItemProps) {
  const { slot, part, defaultClassName, cls, style, children, ref, rest, defaultExpanded, isExpanded, onExpandedChange, isDisabled } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName });
  return (
    <Disclosure
      {...(rest as {})}
      ref={ref as never}
      class={() => rp.class()}
      defaultExpanded={defaultExpanded}
      isExpanded={isExpanded}
      onExpandedChange={onExpandedChange}
      isDisabled={isDisabled}
      render={(p) => <li {...(p as {})} style={style} data-slot={slot} data-sidebar={part} data-expandable="true" />}
    >
      {() => provide(SidebarItemContext, true, () => rp.children())}
    </Disclosure>
  );
}

export interface SidebarMenuItemProps extends SidebarPartProps<HTMLLIElement>, SidebarExpandableProps {}
/** A menu item (`li`): holds a SidebarMenuButton and optional action / badge / sub menu; expandable = a tree node. */
export function SidebarMenuItem(props: SidebarMenuItemProps) {
  const { expandable, defaultExpanded, isExpanded, onExpandedChange, isDisabled, class: cls, style, children, render, ref, ...rest } = props;
  if (isExpandable(props))
    return (
      <SidebarExpandableItem
        slot="sidebar-menu-item"
        part="menu-item"
        defaultClassName="rv-SidebarMenuItem"
        cls={cls}
        style={style}
        ref={ref}
        rest={rest}
        expandable={expandable}
        defaultExpanded={defaultExpanded}
        isExpanded={isExpanded}
        onExpandedChange={onExpandedChange}
        isDisabled={isDisabled}
      >
        {children}
      </SidebarExpandableItem>
    );
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarMenuItem" });
  if (render)
    return render(
      { ...rest, ref, "data-slot": "sidebar-menu-item", "data-sidebar": "menu-item", class: () => rp.class(), style, children: () => rp.children() } as never,
      undefined,
    );
  return (
    <li {...rest} ref={ref as never} data-slot="sidebar-menu-item" data-sidebar="menu-item" class={rp.class()} style={style}>
      {rp.children()}
    </li>
  );
}

/** Rivet: link / action extras of SidebarMenuButton and SidebarMenuSubButton. */
export interface SidebarMenuLinkExtras {
  /** The current page: `aria-current="page"` (and `data-active` unless `isActive` is given); a value or an accessor. */
  isCurrent?: MaybeAccessor<boolean | undefined>;
  /** With `href`: a full document load instead of client routing (`data-rivet-reload`, native router). @default false */
  forceReload?: boolean;
  /** Close the mobile sheet when pressed. @default inherited (menu / group / provider: true) */
  closeMobileOnAction?: boolean;
}

interface MenuButtonExtras extends SidebarMenuLinkExtras {
  /** Marks the current item (`data-active="true"`); a value or an accessor. @default false (`isCurrent`) */
  isActive?: MaybeAccessor<boolean | undefined>;
  /** `data-size`. @default "default" */
  size?: "default" | "sm" | "lg";
  /** Upstream `sidebarMenuButtonVariants` variant, exposed as `data-variant` (headless). @default "default" */
  variant?: "default" | "outline";
  /** A tooltip shown while the sidebar is collapsed (desktop only): its text, or Tooltip props. */
  tooltip?: string | TooltipProps;
}

const NATIVE_ROUTER = { isNative: true };
const EXTERNAL_HREF = /^https?:\/\//i;

/** Link-only props: external http(s) hrefs open in a new tab (unless `target` is given), `forceReload`. */
function linkExtras(rest: { href?: string; target?: string; rel?: string }, forceReload: boolean | undefined): Record<string, unknown> {
  const external = typeof rest.href === "string" && EXTERNAL_HREF.test(rest.href) && rest.target === undefined;
  return {
    ...(external ? { target: "_blank", rel: rest.rel ?? "noopener noreferrer" } : {}),
    ...(forceReload ? { "data-rivet-reload": "" } : {}),
  };
}

/** `SidebarMenuButton`: a cdk Button, or a cdk Link when `href` is given (React Aria base). */
export type SidebarMenuButtonProps = MenuButtonExtras & ((ButtonProps & { href?: undefined }) | (LinkProps & { href: string }));

/** The button / link of a menu item; with `tooltip`, a tooltip while collapsed (not on mobile). */
export function SidebarMenuButton(props: SidebarMenuButtonProps) {
  const s = sidebarState();
  const {
    isActive,
    isCurrent,
    forceReload,
    closeMobileOnAction,
    size = "default",
    variant = "default",
    tooltip,
    class: cls,
    onPress,
    ...rest
  } = props as MenuButtonExtras & ButtonProps & { href?: string };
  const options = useContext(SidebarMenuOptionsContext);
  const close = closeMobileOnAction ?? options?.closeMobileOnAction;
  // In the body (not a helper): the accessors close over component locals, so they resume (a helper's closure is not
  // a registered symbol: "function is not serializable").
  const activeSource = isActive ?? isCurrent ?? false;
  const active = typeof activeSource === "function" ? () => dataBool(activeSource()) : dataBool(activeSource);
  // `aria-current` of `isCurrent` (`undefined`: not set by the sidebar).
  const current =
    isCurrent === undefined ? undefined : typeof isCurrent === "function" ? () => (isCurrent() ? "page" : undefined) : isCurrent ? "page" : undefined;
  const className = cls ?? "rv-SidebarMenuButton";
  const content = () =>
    rest.href !== undefined ? (
      forceReload ? (
        provide(RouterContext, NATIVE_ROUTER, () => (
          <Link
            {...(rest as LinkProps)}
            {...linkExtras(rest, true)}
            {...(current === undefined ? {} : { "aria-current": current })}
            data-slot="sidebar-menu-button"
            data-sidebar="menu-button"
            data-size={size}
            data-variant={variant}
            data-active={active as never}
            class={className as never}
            onPress={(event) => {
              onPress?.(event);
              closeSidebarMobileOnAction(s, close);
            }}
          />
        ))
      ) : (
        <Link
          {...(rest as LinkProps)}
          {...linkExtras(rest, false)}
          {...(current === undefined ? {} : { "aria-current": current })}
          data-slot="sidebar-menu-button"
          data-sidebar="menu-button"
          data-size={size}
          data-variant={variant}
          data-active={active as never}
          class={className as never}
          onPress={(event) => {
            onPress?.(event);
            closeSidebarMobileOnAction(s, close);
          }}
        />
      )
    ) : (
      <Button
        {...rest}
        {...(current === undefined ? {} : { "aria-current": current })}
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        data-size={size}
        data-variant={variant}
        data-active={active as never}
        class={className}
        onPress={(event) => {
          onPress?.(event);
          // A tree trigger (slot="trigger") toggles its item, it is not an action.
          if (rest.slot !== "trigger") closeSidebarMobileOnAction(s, close);
        }}
      />
    );
  if (!tooltip) return content();
  const tip: TooltipProps = typeof tooltip === "string" ? { children: tooltip } : tooltip;
  return (
    <TooltipTrigger delay={0} isDisabled={() => s.open() || sidebarViewportIsMobile()}>
      {content()}
      <Tooltip placement="right" {...tip} />
    </TooltipTrigger>
  );
}

/** Rivet: SidebarMenuTrigger — the expand / collapse button of an expandable item (a SidebarMenuButton, `slot="trigger"`). */
export type SidebarMenuTriggerProps = Omit<MenuButtonExtras, "forceReload" | "closeMobileOnAction" | "isCurrent"> & Omit<ButtonProps, "slot">;

/** Rivet: the trigger of an expandable (tree) item: toggles it, `aria-expanded` / `aria-controls` from the Disclosure. */
export function SidebarMenuTrigger(props: SidebarMenuTriggerProps) {
  return <SidebarMenuButton {...(props as ButtonProps)} slot="trigger" />;
}

export type SidebarMenuIndicatorProps = SidebarPartProps<HTMLSpanElement>;
/**
 * Rivet: the expand indicator inside a SidebarMenuTrigger (`span`, `aria-hidden`; your icon as children). CSS rotates
 * it while the item is expanded (`[aria-expanded="true"]`).
 */
export function SidebarMenuIndicator(props: SidebarMenuIndicatorProps) {
  const { class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarMenuIndicator" });
  if (render)
    return render(
      {
        ...rest,
        ref,
        "aria-hidden": "true",
        "data-slot": "sidebar-menu-indicator",
        "data-sidebar": "menu-indicator",
        class: () => rp.class(),
        style,
        children: () => rp.children(),
      } as never,
      undefined,
    );
  return (
    <span {...rest} ref={ref as never} aria-hidden="true" data-slot="sidebar-menu-indicator" data-sidebar="menu-indicator" class={rp.class()} style={style}>
      {rp.children()}
    </span>
  );
}

export interface SidebarMenuActionProps extends ButtonProps {
  /** Shown only while the item is hovered / focused (desktop): `data-show-on-hover="true"`. @default false */
  showOnHover?: boolean;
}

/** An action button next to a menu button (cdk Button, React Aria base). */
export function SidebarMenuAction(props: SidebarMenuActionProps) {
  const { showOnHover = false, class: cls, ...rest } = props;
  return (
    <Button
      {...rest}
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      data-show-on-hover={dataBool(showOnHover)}
      class={cls ?? "rv-SidebarMenuAction"}
    />
  );
}

export interface SidebarMenuActionsProps extends SidebarPartProps<HTMLDivElement> {
  /** Shown only while the item is hovered / focused (desktop): `data-show-on-hover="true"`. @default false */
  showOnHover?: boolean;
}

/** Rivet: several SidebarMenuAction buttons at the end of a menu item (`div`, `role="group"`). */
export function SidebarMenuActions(props: SidebarMenuActionsProps) {
  const { showOnHover = false, class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarMenuActions" });
  if (render)
    return render(
      {
        role: "group",
        ...rest,
        ref,
        "data-slot": "sidebar-menu-actions",
        "data-sidebar": "menu-actions",
        "data-show-on-hover": dataBool(showOnHover),
        class: () => rp.class(),
        style,
        children: () => rp.children(),
      } as never,
      undefined,
    );
  return (
    <div
      role="group"
      {...rest}
      ref={ref as never}
      data-slot="sidebar-menu-actions"
      data-sidebar="menu-actions"
      data-show-on-hover={dataBool(showOnHover)}
      class={rp.class()}
      style={style}
    >
      {rp.children()}
    </div>
  );
}

export type SidebarMenuBadgeProps = SidebarPartProps<HTMLDivElement>;
/** A badge (count) in a menu item. */
export function SidebarMenuBadge(props: SidebarMenuBadgeProps) {
  const { class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarMenuBadge" });
  if (render)
    return render(
      { ...rest, ref, "data-slot": "sidebar-menu-badge", "data-sidebar": "menu-badge", class: () => rp.class(), style, children: () => rp.children() } as never,
      undefined,
    );
  return (
    <div {...rest} ref={ref as never} data-slot="sidebar-menu-badge" data-sidebar="menu-badge" class={rp.class()} style={style}>
      {rp.children()}
    </div>
  );
}

export interface SidebarMenuSkeletonProps extends SidebarPartProps<HTMLDivElement> {
  /** Renders the icon placeholder too. @default false */
  showIcon?: boolean;
  /** Class of the icon placeholder. @default "rv-SidebarMenuSkeleton-icon" */
  iconClass?: string;
  /** Class of the text placeholder (width `--skeleton-width`, random 50–90%). @default "rv-SidebarMenuSkeleton-text" */
  textClass?: string;
}

/** A loading placeholder for a menu item. */
export function SidebarMenuSkeleton(props: SidebarMenuSkeletonProps) {
  const { showIcon = false, iconClass, textClass, class: cls, style, render, ref, children: _children, ...rest } = props;
  // Random width between 50 to 90%. Rivet: state (upstream `useState`), so the server's pick is the page's: a resumed or
  // adopted skeleton keeps the width the markup shows.
  const width = signal(`${Math.floor(Math.random() * 40) + 50}%`);
  const rp = renderProps({ class: cls, values: NONE, defaultClassName: "rv-SidebarMenuSkeleton" });
  const parts = () => (
    <>
      {showIcon ? <div class={iconClass ?? "rv-SidebarMenuSkeleton-icon"} data-sidebar="menu-skeleton-icon" /> : null}
      <div class={textClass ?? "rv-SidebarMenuSkeleton-text"} data-sidebar="menu-skeleton-text" style={{ "--skeleton-width": width() }} />
    </>
  );
  if (render)
    return render(
      { ...rest, ref, "data-slot": "sidebar-menu-skeleton", "data-sidebar": "menu-skeleton", class: () => rp.class(), style, children: parts } as never,
      undefined,
    );
  return (
    <div {...rest} ref={ref as never} data-slot="sidebar-menu-skeleton" data-sidebar="menu-skeleton" class={rp.class()} style={style}>
      {parts()}
    </div>
  );
}

export interface SidebarMenuSubProps extends SidebarPartProps<HTMLUListElement> {
  /** Rivet: inside an expandable item, class of the DisclosurePanel around the list. @default "rv-SidebarMenuSub-panel" */
  panelClass?: string;
}
/** A nested menu (`ul`); inside an expandable item it sits in the item's DisclosurePanel (`data-slot="sidebar-menu-sub-panel"`). */
export function SidebarMenuSub(props: SidebarMenuSubProps) {
  const { panelClass, class: cls, style, children, render, ref, ...rest } = props;
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarMenuSub" });
  const list = () =>
    render ? (
      render(
        { ...rest, ref, "data-slot": "sidebar-menu-sub", "data-sidebar": "menu-sub", class: () => rp.class(), style, children: () => rp.children() } as never,
        undefined,
      )
    ) : (
      <ul {...rest} ref={ref as never} data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class={rp.class()} style={style}>
        {rp.children()}
      </ul>
    );
  if (!useContext(SidebarItemContext)) return list();
  // An expandable item's sub menu: the Disclosure panel (animated size, `hidden="until-found"` when collapsed).
  return (
    <DisclosurePanel
      class={panelClass ?? "rv-SidebarMenuSub-panel"}
      render={(p) => <div {...(p as {})} data-slot="sidebar-menu-sub-panel" data-sidebar="menu-sub-panel" />}
    >
      {() => provide(SidebarItemContext, false, () => list())}
    </DisclosurePanel>
  );
}

export interface SidebarMenuSubItemProps extends SidebarPartProps<HTMLLIElement>, SidebarExpandableProps {}
/** An item of a nested menu (`li`); expandable = a nested tree node. */
export function SidebarMenuSubItem(props: SidebarMenuSubItemProps) {
  const { expandable, defaultExpanded, isExpanded, onExpandedChange, isDisabled, class: cls, style, children, render, ref, ...rest } = props;
  if (isExpandable(props))
    return (
      <SidebarExpandableItem
        slot="sidebar-menu-sub-item"
        part="menu-sub-item"
        defaultClassName="rv-SidebarMenuSubItem"
        cls={cls}
        style={style}
        ref={ref}
        rest={rest}
        expandable={expandable}
        defaultExpanded={defaultExpanded}
        isExpanded={isExpanded}
        onExpandedChange={onExpandedChange}
        isDisabled={isDisabled}
      >
        {children}
      </SidebarExpandableItem>
    );
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarMenuSubItem" });
  if (render)
    return render(
      {
        ...rest,
        ref,
        "data-slot": "sidebar-menu-sub-item",
        "data-sidebar": "menu-sub-item",
        class: () => rp.class(),
        style,
        children: () => rp.children(),
      } as never,
      undefined,
    );
  return (
    <li {...rest} ref={ref as never} data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" class={rp.class()} style={style}>
      {rp.children()}
    </li>
  );
}

interface MenuSubButtonExtras extends SidebarMenuLinkExtras {
  /** `data-size`. @default "md" */
  size?: "sm" | "md";
  /** Marks the current item (`data-active="true"`); a value or an accessor. @default false (`isCurrent`) */
  isActive?: MaybeAccessor<boolean | undefined>;
}

/** `SidebarMenuSubButton`: a cdk Link with `href`, else a cdk Button (React Aria base; new-york: `<a>`). */
export type SidebarMenuSubButtonProps = MenuSubButtonExtras & ((ButtonProps & { href?: undefined }) | (LinkProps & { href: string }));

/** The link / button of a sub menu item. */
export function SidebarMenuSubButton(props: SidebarMenuSubButtonProps) {
  const s = sidebarState();
  const {
    size = "md",
    isActive,
    isCurrent,
    forceReload,
    closeMobileOnAction,
    class: cls,
    onPress,
    ...rest
  } = props as MenuSubButtonExtras & ButtonProps & { href?: string };
  const options = useContext(SidebarMenuOptionsContext);
  const close = closeMobileOnAction ?? options?.closeMobileOnAction;
  // In the body (not a helper): the accessors close over component locals, so they resume (a helper's closure is not
  // a registered symbol: "function is not serializable").
  const activeSource = isActive ?? isCurrent ?? false;
  const active = typeof activeSource === "function" ? () => dataBool(activeSource()) : dataBool(activeSource);
  // `aria-current` of `isCurrent` (`undefined`: not set by the sidebar).
  const current =
    isCurrent === undefined ? undefined : typeof isCurrent === "function" ? () => (isCurrent() ? "page" : undefined) : isCurrent ? "page" : undefined;
  const className = cls ?? "rv-SidebarMenuSubButton";
  if (rest.href === undefined)
    return (
      <Button
        {...rest}
        {...(current === undefined ? {} : { "aria-current": current })}
        data-slot="sidebar-menu-sub-button"
        data-sidebar="menu-sub-button"
        data-size={size}
        data-active={active as never}
        class={className}
        onPress={(event) => {
          onPress?.(event);
          if (rest.slot !== "trigger") closeSidebarMobileOnAction(s, close);
        }}
      />
    );
  const link = () => (
    <Link
      {...(rest as LinkProps)}
      {...linkExtras(rest, forceReload)}
      {...(current === undefined ? {} : { "aria-current": current })}
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={active as never}
      class={className as never}
      onPress={(event) => {
        onPress?.(event);
        closeSidebarMobileOnAction(s, close);
      }}
    />
  );
  return forceReload ? provide(RouterContext, NATIVE_ROUTER, link) : link();
}
