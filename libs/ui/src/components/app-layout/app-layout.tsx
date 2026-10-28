// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no app layout). Feature set (props, parts, defaults, class / variable
// names) inspired by HeroUI Pro's public AppLayout docs; independent implementation. Scaffold over `@rivetjs/ui/sidebar`
// (shadcn/ui Sidebar behaviour via `@rivetjs/cdk/sidebar`): full-height sidebar + sticky navbar + main + optional aside.
// Rivet:
// - Root = ui `Sidebar.Provider` (wrapper `div.sidebar-wrapper.app-layout`): `sidebarOpen` / `defaultSidebarOpen` /
//   `onSidebarOpenChange` → `open` / `defaultOpen` / `onOpenChange`; `sidebarSide` / `sidebarVariant` / `sidebarCollapsible`
//   (default `icon`) → the provider defaults every `<Sidebar>` inside reads (its own props win); `toggleShortcut`,
//   `reduceMotion`, `navigate` / `useHref` forwarded as is.
// - Slots `sidebar`, `navbar`, `aside`, `toolbar`, `footer`: lazy (`r:slot` children or function props); an eager JSX element
//   passed as a prop is built where it is written, outside the layout's providers on the server.
// - Body = `div.sidebar__inset.app-layout__body` (the sidebar CSS sibling rules for the inset variant apply) holding the
//   sticky `header`, the toolbar, `main` + `aside` and the footer. Responsive rules are CSS (no viewport check at load).
// - Aside: open state = cdk `controllable` (`asideOpen` value / Signal / accessor, `defaultAsideOpen` true,
//   `onAsideOpenChange`), `aside_state` cookie on change (`asideCookieOpen` reads it for SSR), hidden below 1024 px, or with
//   `asideMobile="sheet"` a right ui `Drawer` (`AppLayout.MobileAside` content renders only there). `asideToggleShortcut`
//   (off by default; sidebar shortcut syntax) = delegated wrapper keydown + a window listener once the runtime runs.
// - Resizable sidebar / aside: WAI-ARIA window-splitter handles (`role="separator"`, `aria-valuenow` in %, arrows ± 1 %,
//   Shift ± 10 %, Home / End, Enter resets) + pointer drag; widths are `clamp(min, size, max)` CSS; `resizableAutoSaveId`
//   persists them in `localStorage` (restored by a `clientEffect` at idle: opt-in runtime start).
// - Motion: CSS transitions (aside width / translate, `--app-layout-aside-duration`), off with `reduceMotion` or
//   `prefers-reduced-motion`.
import { Icon } from "@rivetjs/kit/icon";
import { resumedId } from "@rivetjs/cdk/id";
import { createContext, useContext, type Signal } from "@rivetjs/reactivity";
import { Provider, clientEffect, clientEvent } from "@rivetjs/runtime/dom";
import type { Content, JSX, Slot } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";
import { Menu, PanelRight } from "lucide";

import type { AppLayoutVariants } from "../../../styles/src/components/app-layout/index.ts";
import { appLayoutVariants } from "../../../styles/src/components/app-layout/index.ts";
import { ButtonRoot as Button } from "../button/button.tsx";
import { DrawerBackdrop, DrawerBody, DrawerContainer, DrawerDialog } from "../drawer/drawer.tsx";
import { SidebarProvider, SidebarTrigger } from "../sidebar/sidebar.tsx";
import { TooltipContent, TooltipRoot } from "../tooltip/tooltip.tsx";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import {
  asideShortcutKeyDown,
  clampedSize,
  createAsideState,
  createPanelSizeState,
  isAsideOpen,
  panelKeyDown,
  panelPercent,
  percentBound,
  restorePanelSize,
  setAsideOpen,
  setPanelPixels,
  toggleAside,
  type AppLayoutSize,
  type AsideState,
  type PanelSizeState,
} from "./app-layout-state.ts";

/* ------------------------------------------------------------------------------------------------
 * Context
 * --------------------------------------------------------------------------------------------- */
interface AppLayoutContextValue {
  aside: AsideState;
  /** `asideMobile === "sheet"`. */
  sheet: boolean;
  /** Id of the desktop aside (`aria-controls`). */
  asideId: string;
  /** Rendering inside the mobile aside sheet (`AppLayout.MobileAside` shows its children only there). */
  inSheet?: boolean;
}

const AppLayoutContext = createContext<AppLayoutContextValue | null>(null);

type AppLayoutSlots = ReturnType<typeof appLayoutVariants>;
let SLOTS: AppLayoutSlots | undefined;
const slots = (): AppLayoutSlots => (SLOTS ??= appLayoutVariants({}));

/** The nearest `AppLayout`'s aside API (`null` outside one). */
export interface AppLayoutApi {
  isAsideOpen: () => boolean;
  setAsideOpen: (open: boolean) => void;
  toggleAside: () => void;
}

export function useAppLayout(): AppLayoutApi | null {
  const ctx = useContext(AppLayoutContext);
  if (!ctx) return null;
  const aside = ctx.aside;
  const sheet = ctx.sheet;
  return {
    isAsideOpen: () => isAsideOpen(aside),
    setAsideOpen: (open: boolean) => setAsideOpen(aside, open),
    toggleAside: () => toggleAside(aside, sheet),
  };
}

/* -------------------------------------------------------------------------------------------------
 * Tooltip props (MenuToggle / AsideTrigger)
 * -----------------------------------------------------------------------------------------------*/
export interface AppLayoutTooltipProps {
  /** @default "bottom" */
  placement?: "top" | "bottom" | "left" | "right" | "start" | "end";
  delay?: number;
  closeDelay?: number;
  offset?: number;
  showArrow?: boolean;
  isDisabled?: boolean;
  class?: string;
}

/* -------------------------------------------------------------------------------------------------
 * AppLayout Root
 * -----------------------------------------------------------------------------------------------*/
type SlotProp = Slot | Content;

interface AppLayoutRootProps extends AppLayoutVariants {
  /** The sidebar (a `<Sidebar>`): `r:slot="sidebar"` child or a function prop. */
  sidebar?: SlotProp;
  /** The sticky top bar content. */
  navbar?: SlotProp;
  /** The right panel content (desktop column; with `asideMobile="sheet"` also the mobile sheet). */
  aside?: SlotProp;
  /** A bar under the navbar. */
  toolbar?: SlotProp;
  /** A footer under the main content. */
  footer?: SlotProp;
  /** Main content. */
  children?: Content;

  sidebarOpen?: boolean | Signal<boolean> | (() => boolean);
  /** @default true */
  defaultSidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  /** @default "left" */
  sidebarSide?: "left" | "right";
  /** @default "sidebar" */
  sidebarVariant?: "sidebar" | "floating" | "inset";
  /** @default "icon" */
  sidebarCollapsible?: "icon" | "offcanvas" | "none";
  /** Sidebar toggle shortcut (`false` disables). @default "mod+b" */
  toggleShortcut?: string | false | null;
  /** Turns off layout + sidebar animations (on top of `prefers-reduced-motion`). @default false */
  reduceMotion?: boolean;
  /** Client-side navigation for the sidebar's links. */
  navigate?: (href: string, routerOptions: unknown) => void;
  useHref?: (href: string) => string;

  asideOpen?: boolean | Signal<boolean> | (() => boolean);
  /** @default true */
  defaultAsideOpen?: boolean;
  onAsideOpenChange?: (open: boolean) => void;
  /** Aside toggle shortcut (`"mod+shift+b"`); off by default. */
  asideToggleShortcut?: string | false | null;
  /** Below 1024 px: hide the aside, or show it in a sheet (`AppLayout.AsideTrigger` opens it). @default "hidden" */
  asideMobile?: "hidden" | "sheet";
  /** Accessible name of the aside landmark / sheet. @default "Details" */
  asideLabel?: string;

  /** @default false */
  sidebarResizable?: boolean;
  /** Numbers = % of the layout width, strings = CSS lengths. @default 18 */
  sidebarDefaultSize?: AppLayoutSize;
  /** @default 12 */
  sidebarMinSize?: AppLayoutSize;
  /** @default 30 */
  sidebarMaxSize?: AppLayoutSize;
  /** @default "preserve-relative-size" */
  sidebarResizeBehavior?: "preserve-relative-size" | "preserve-pixel-size";
  /** @default false */
  asideResizable?: boolean;
  /** @default 20 */
  asideDefaultSize?: AppLayoutSize;
  /** @default 15 */
  asideMinSize?: AppLayoutSize;
  /** @default 40 */
  asideMaxSize?: AppLayoutSize;
  /** @default "preserve-relative-size" */
  asideResizeBehavior?: "preserve-relative-size" | "preserve-pixel-size";
  /** Persists resized widths in `localStorage` under `<id>:sidebar` / `<id>:aside`. */
  resizableAutoSaveId?: string;

  /** `page`: the window scrolls (sticky header); `content`: the layout fills the viewport and `main` scrolls. @default "page" */
  scrollMode?: "page" | "content";
  class?: string;
  id?: string;
  style?: Record<string, string>;
  [attribute: `data-${string}`]: unknown;
}

const ROOT_KEYS = [
  "sidebar",
  "navbar",
  "aside",
  "toolbar",
  "footer",
  "children",
  "class",
  "id",
  "style",
  "sidebarOpen",
  "defaultSidebarOpen",
  "onSidebarOpenChange",
  "sidebarSide",
  "sidebarVariant",
  "sidebarCollapsible",
  "toggleShortcut",
  "reduceMotion",
  "navigate",
  "useHref",
  "asideOpen",
  "defaultAsideOpen",
  "onAsideOpenChange",
  "asideToggleShortcut",
  "asideMobile",
  "asideLabel",
  "sidebarResizable",
  "sidebarDefaultSize",
  "sidebarMinSize",
  "sidebarMaxSize",
  "sidebarResizeBehavior",
  "asideResizable",
  "asideDefaultSize",
  "asideMinSize",
  "asideMaxSize",
  "asideResizeBehavior",
  "resizableAutoSaveId",
  "scrollMode",
] as const;

/** Layout box + text direction of the layout around a handle. */
const layoutOf = (el: Element): { rect: DOMRect; rtl: boolean } => {
  const layout = el.closest("[data-app-layout]") ?? el;
  return { rect: layout.getBoundingClientRect(), rtl: getComputedStyle(layout).direction === "rtl" };
};

const AppLayoutRoot = (props: AppLayoutRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ROOT_KEYS);
  const id = local.id ?? resumedId();
  const asideId = `${id}-aside`;
  const sheet = local.asideMobile === "sheet";
  const aside = createAsideState(local);
  const autoSave = local.resizableAutoSaveId;
  const sidebarSize: PanelSizeState | null = local.sidebarResizable
    ? createPanelSizeState(
        local.sidebarDefaultSize ?? 18,
        local.sidebarMinSize ?? 12,
        local.sidebarMaxSize ?? 30,
        local.sidebarResizeBehavior,
        autoSave ? `${autoSave}:sidebar` : null,
      )
    : null;
  const asideSize: PanelSizeState | null = local.asideResizable
    ? createPanelSizeState(
        local.asideDefaultSize ?? 20,
        local.asideMinSize ?? 15,
        local.asideMaxSize ?? 40,
        local.asideResizeBehavior,
        autoSave ? `${autoSave}:aside` : null,
      )
    : null;
  const ctx: AppLayoutContextValue = { aside, sheet, asideId };
  const sideRight = (local.sidebarSide ?? "left") === "right";
  const scrollMode = local.scrollMode ?? "page";
  const hasAside = local.aside != null;
  const asideLabel = local.asideLabel ?? "Details";

  // The aside shortcut: window-wide once the runtime runs; cold, the wrapper's delegated keydown (handled once).
  // `standalone: false`: it never boots the page (a standalone `clientEvent` sets the idle trigger, TOAST-ACTIVE).
  if (aside.shortcut)
    clientEvent(window, "keydown", (event: KeyboardEvent) => asideShortcutKeyDown(event, aside, sheet), { preload: "interaction", standalone: false });
  // Persisted widths (opt-in): restored at idle; the sidebar width variable lives on the wrapper (set imperatively).
  if (autoSave && (sidebarSize || asideSize))
    clientEffect(
      () => {
        if (sidebarSize) {
          restorePanelSize(sidebarSize);
          const wrapper = document.querySelector(`[data-app-layout="${id}"]`) as HTMLElement | null;
          wrapper?.style.setProperty("--sidebar-width", clampedSize(sidebarSize.size(), sidebarSize.min, sidebarSize.max));
        }
        if (asideSize) restorePanelSize(asideSize);
      },
      { when: "idle" },
    );

  const style = {
    ...(sidebarSize ? { "--sidebar-width": clampedSize(sidebarSize.defaultSize, sidebarSize.min, sidebarSize.max) } : {}),
    ...local.style,
  };

  // Resize handle of the sidebar: on its inner edge (the body's start edge, or end edge with a right sidebar).
  const sidebarHandle = () =>
    sidebarSize ? (
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={panelPercent(sidebarSize)}
        aria-valuemin={percentBound(sidebarSize.min)}
        aria-valuemax={percentBound(sidebarSize.max)}
        class={slots().resizeHandle()}
        data-slot="app-layout-sidebar-handle"
        data-panel="sidebar"
        data-side={sideRight ? "right" : "left"}
        onPointerDown={(event: PointerEvent) => {
          const handle = event.currentTarget as HTMLElement;
          handle.setPointerCapture?.(event.pointerId);
          handle.setAttribute("data-dragging", "true");
        }}
        onPointerMove={(event: PointerEvent) => {
          const handle = event.currentTarget as HTMLElement;
          if (!handle.hasAttribute("data-dragging")) return;
          const { rect, rtl } = layoutOf(handle);
          const atStart = sideRight === rtl;
          setPanelPixels(sidebarSize, atStart ? event.clientX - rect.left : rect.right - event.clientX, rect.width);
          (handle.closest("[data-app-layout]") as HTMLElement).style.setProperty(
            "--sidebar-width",
            clampedSize(sidebarSize.size(), sidebarSize.min, sidebarSize.max),
          );
        }}
        onPointerUp={(event: PointerEvent) => (event.currentTarget as HTMLElement).removeAttribute("data-dragging")}
        onPointerCancel={(event: PointerEvent) => (event.currentTarget as HTMLElement).removeAttribute("data-dragging")}
        onKeyDown={(event: KeyboardEvent) => {
          const handle = event.currentTarget as HTMLElement;
          const { rect, rtl } = layoutOf(handle);
          const layout = handle.closest("[data-app-layout]") as HTMLElement;
          const gap = layout.querySelector('[data-slot="sidebar-gap"]');
          const current = gap ? gap.getBoundingClientRect().width : 0;
          if (panelKeyDown(sidebarSize, event, current, rect.width, sideRight ? "start" : "end", rtl)) {
            event.preventDefault();
            layout.style.setProperty("--sidebar-width", clampedSize(sidebarSize.size(), sidebarSize.min, sidebarSize.max));
          }
        }}
      />
    ) : null;

  const asideHandle = () =>
    asideSize ? (
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Resize aside"
        aria-controls={asideId}
        aria-valuenow={panelPercent(asideSize)}
        aria-valuemin={percentBound(asideSize.min)}
        aria-valuemax={percentBound(asideSize.max)}
        class={slots().resizeHandle()}
        data-slot="app-layout-aside-handle"
        data-panel="aside"
        onPointerDown={(event: PointerEvent) => {
          const handle = event.currentTarget as HTMLElement;
          handle.setPointerCapture?.(event.pointerId);
          handle.setAttribute("data-dragging", "true");
        }}
        onPointerMove={(event: PointerEvent) => {
          const handle = event.currentTarget as HTMLElement;
          if (!handle.hasAttribute("data-dragging")) return;
          const { rect, rtl } = layoutOf(handle);
          setPanelPixels(asideSize, rtl ? event.clientX - rect.left : rect.right - event.clientX, rect.width);
        }}
        onPointerUp={(event: PointerEvent) => (event.currentTarget as HTMLElement).removeAttribute("data-dragging")}
        onPointerCancel={(event: PointerEvent) => (event.currentTarget as HTMLElement).removeAttribute("data-dragging")}
        onKeyDown={(event: KeyboardEvent) => {
          const handle = event.currentTarget as HTMLElement;
          const { rect, rtl } = layoutOf(handle);
          const panel = handle.parentElement?.querySelector(`#${CSS.escape(asideId)}`);
          const current = panel ? panel.getBoundingClientRect().width : 0;
          if (panelKeyDown(asideSize, event, current, rect.width, "start", rtl)) event.preventDefault();
        }}
      />
    ) : null;

  // A function: Rivet JSX builds nodes eagerly, the parts must be created inside the providers.
  const content = () => (
    <Provider token={AppLayoutContext} value={ctx}>
      {renderSlot(local.sidebar)}
      <div class={slots().body()} data-slot="app-layout-body">
        {sidebarHandle()}
        <header class={slots().header()} data-slot="app-layout-header">
          {renderSlot(local.navbar)}
        </header>
        {local.toolbar != null ? (
          <div class={slots().toolbar()} data-slot="app-layout-toolbar">
            {renderSlot(local.toolbar)}
          </div>
        ) : null}
        <div class={slots().content()} data-slot="app-layout-content">
          <main class={slots().main()} data-slot="app-layout-main">
            {local.children}
          </main>
          {hasAside ? asideHandle() : null}
          {hasAside ? (
            <aside
              id={asideId}
              aria-label={asideLabel}
              class={slots().aside()}
              data-slot="app-layout-aside"
              data-state={isAsideOpen(aside) ? "open" : "closed"}
              inert={!isAsideOpen(aside)}
              style={asideSize ? { "--app-layout-aside-width": clampedSize(asideSize.size(), asideSize.min, asideSize.max) } : undefined}
            >
              <div class={slots().asideInner()} data-slot="app-layout-aside-inner">
                {renderSlot(local.aside)}
              </div>
            </aside>
          ) : null}
        </div>
        {local.footer != null ? (
          <footer class={slots().footer()} data-slot="app-layout-footer">
            {renderSlot(local.footer)}
          </footer>
        ) : null}
      </div>
      {hasAside && sheet ? (
        <DrawerBackdrop isOpen={aside.mobileOpen} class={slots().sheetBackdrop()}>
          <DrawerContainer placement="right">
            <DrawerDialog id={`${asideId}-sheet`} aria-label={asideLabel} class={slots().sheet()}>
              <DrawerBody>
                <Provider token={AppLayoutContext} value={{ ...ctx, inSheet: true }}>
                  {renderSlot(local.aside)}
                </Provider>
              </DrawerBody>
            </DrawerDialog>
          </DrawerContainer>
        </DrawerBackdrop>
      ) : null}
    </Provider>
  );

  return (
    <SidebarProvider
      {...(rest as {})}
      class={appLayoutVariants({ scrollMode }).base({ class: local.class })}
      style={style}
      data-app-layout={id}
      data-scroll-mode={scrollMode}
      data-sidebar-side={sideRight ? "right" : "left"}
      data-aside-mobile={sheet ? "sheet" : "hidden"}
      open={local.sidebarOpen}
      defaultOpen={local.defaultSidebarOpen}
      onOpenChange={local.onSidebarOpenChange}
      side={local.sidebarSide}
      variant={local.sidebarVariant}
      collapsible={local.sidebarCollapsible ?? "icon"}
      toggleShortcut={local.toggleShortcut}
      reduceMotion={local.reduceMotion}
      navigate={local.navigate as never}
      useHref={local.useHref as never}
      onKeyDown={aside.shortcut ? (event: KeyboardEvent) => asideShortcutKeyDown(event, aside, sheet) : undefined}
    >
      {content()}
    </SidebarProvider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AppLayout MenuToggle (mobile only: opens the sidebar sheet)
 * -----------------------------------------------------------------------------------------------*/
interface AppLayoutMenuToggleProps {
  /** Replaces the default lucide `Menu` icon. */
  children?: Content;
  /** Tooltip text (none by default). */
  tooltip?: string;
  tooltipProps?: AppLayoutTooltipProps;
  /** @default "Open navigation" */
  "aria-label"?: string;
  class?: string;
  id?: string;
}

const AppLayoutMenuToggle = (props: AppLayoutMenuToggleProps): JSX.Element => {
  const [local] = splitLive(props, ["children", "tooltip", "tooltipProps", "aria-label", "class", "id"]);
  const label = local["aria-label"] ?? "Open navigation";
  const hasChildren = "children" in props && props.children !== undefined;
  const trigger = () => (
    <SidebarTrigger class={composeSlotClassName(slots().menuToggle, local.class)} id={local.id} data-slot="app-layout-menu-toggle" aria-label={label}>
      {hasChildren ? local.children : <Icon icon={Menu} size={16} data-slot="app-layout-menu-toggle-icon" />}
    </SidebarTrigger>
  );
  if (!local.tooltip) return trigger();
  const tp = local.tooltipProps ?? {};
  return (
    <TooltipRoot delay={tp.delay} closeDelay={tp.closeDelay} isDisabled={tp.isDisabled}>
      {trigger()}
      <TooltipContent placement={tp.placement ?? "bottom"} offset={tp.offset} showArrow={tp.showArrow} class={tp.class}>
        {local.tooltip}
      </TooltipContent>
    </TooltipRoot>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AppLayout AsideTrigger
 * -----------------------------------------------------------------------------------------------*/
interface AppLayoutAsideTriggerProps {
  /** Replaces the default lucide `PanelRight` icon. In sheet mode, use inline JSX or a render function (rendered once per viewport). */
  children?: Content;
  /** Tooltip while the aside is closed. @default "Show panel" */
  closedTooltip?: string;
  /** Tooltip while the aside is open. @default "Hide panel" */
  openTooltip?: string;
  tooltipProps?: AppLayoutTooltipProps;
  "aria-label"?: string;
  class?: string;
  id?: string;
}

const AppLayoutAsideTrigger = (props: AppLayoutAsideTriggerProps): JSX.Element => {
  const ctx = useContext(AppLayoutContext);
  if (!ctx) throw new Error("AppLayout.AsideTrigger must be used within an AppLayout.");
  // CSS selects the visible button, including its ARIA state, before any runtime starts and on resize.
  return (
    <>
      <AppLayoutAsideTriggerButton {...props} mobile={false} />
      {ctx.sheet ? <AppLayoutAsideTriggerButton {...props} mobile /> : null}
    </>
  );
};

const AppLayoutAsideTriggerButton = (props: AppLayoutAsideTriggerProps & { mobile: boolean }): JSX.Element => {
  const [local] = splitLive(props, ["children", "closedTooltip", "openTooltip", "tooltipProps", "aria-label", "class", "id"]);
  const ctx = useContext(AppLayoutContext);
  if (!ctx) throw new Error("AppLayout.AsideTrigger must be used within an AppLayout.");
  const aside = ctx.aside;
  const sheet = ctx.sheet;
  const mobile = props.mobile;
  const open = () => (mobile ? aside.mobileOpen() : isAsideOpen(aside));
  const closedTip = local.closedTooltip ?? "Show panel";
  const openTip = local.openTooltip ?? "Hide panel";
  const hasChildren = "children" in props && props.children !== undefined;
  const tp = local.tooltipProps ?? {};
  return (
    <TooltipRoot delay={tp.delay} closeDelay={tp.closeDelay} isDisabled={tp.isDisabled}>
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        id={mobile && local.id ? `${local.id}-mobile` : local.id}
        class={composeSlotClassName(slots().asideTrigger, local.class)}
        data-slot="app-layout-aside-trigger"
        data-sheet={sheet ? "true" : undefined}
        data-viewport={mobile ? "mobile" : "desktop"}
        aria-label={local["aria-label"] ?? (() => (open() ? openTip : closedTip))}
        aria-expanded={() => (open() ? "true" : "false")}
        aria-controls={mobile ? `${ctx.asideId}-sheet` : ctx.asideId}
        {...{ "data-state": () => (open() ? "open" : "closed") }}
        onPress={() => toggleAside(aside, sheet)}
      >
        {hasChildren ? local.children : <Icon icon={PanelRight} size={16} data-slot="app-layout-aside-trigger-icon" />}
      </Button>
      <TooltipContent placement={tp.placement ?? "bottom"} offset={tp.offset} showArrow={tp.showArrow} class={tp.class}>
        {open() ? openTip : closedTip}
      </TooltipContent>
    </TooltipRoot>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AppLayout MobileAside (content shown only in the mobile aside sheet)
 * -----------------------------------------------------------------------------------------------*/
interface AppLayoutMobileAsideProps {
  children?: Content;
}

const AppLayoutMobileAside = (props: AppLayoutMobileAsideProps): JSX.Element => {
  const ctx = useContext(AppLayoutContext);
  return (ctx?.inSheet ? renderSlot(props.children) : null) as JSX.Element;
};

export { AppLayoutRoot, AppLayoutMenuToggle, AppLayoutAsideTrigger, AppLayoutMobileAside, AppLayoutContext };
export type { AppLayoutRootProps, AppLayoutMenuToggleProps, AppLayoutAsideTriggerProps, AppLayoutMobileAsideProps, AppLayoutContextValue };
