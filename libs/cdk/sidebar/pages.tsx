// Rivet (no shadcn upstream; feature set inspired by HeroUI Pro's public Sidebar docs, independent implementation):
// an animated page switcher inside the sidebar — `SidebarPages` (value / defaultValue / onValueChange) holds the active
// page, `SidebarPage value` is one page. Drill-in / back navigation: a menu button sets the value
// (`useSidebarPages().setActiveValue("settings")`).
// - State = `controllable(value, defaultValue, onValueChange)`; without `defaultValue` the first page rendered is
//   active (`first`, set while the pages render).
// - Markup: `div[data-slot=sidebar-pages]` (inline `display: grid; overflow: hidden` — behaviour-critical: pages stack in
//   one cell, the slide is clipped) > `div[data-slot=sidebar-page][data-value]` (inline `grid-area: 1 / 1`). Inactive
//   pages: `hidden`, `inert`, `aria-hidden="true"`; the active one `data-active="true"`.
// - Nothing runs at load: the page's `hidden` binding (re-run on a change) starts the transition in a microtask (once
//   per container): the entering page slides in from the side of its order (DOM order of the pages; RTL flips), the
//   leaving page slides out and gets `hidden` when the motion settles. Motion = `@rivetjs/cdk/motion` `Motion1D`
//   (embla physics, the house motion); `reduceMotion` (pages → menu / group options → provider) or
//   `prefers-reduced-motion` → instant switch. Focus inside the leaving page moves to the entering page's first
//   focusable element.
import { createContext, provide, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { ref as createRef } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { Motion1D } from "../motion/index.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { mergeRefValues, renderProps, type ClassNameOrFunction, type RefValue, type StyleObject } from "../slots/index.tsx";
import { SidebarContext, SidebarMenuOptionsContext, sidebarReducedMotion } from "./state.ts";

const NONE = {};

/** `SidebarPages` state (serializable). */
export interface SidebarPagesState {
  /** @internal controlled value (`value` / `defaultValue` / `onValueChange`). */
  readonly control: ControlledState<string | undefined>;
  /** @internal the first page rendered (active when neither `value` nor `defaultValue` is given). */
  readonly first: Signal<string | undefined>;
  /** `reduceMotion` resolved at render (pages → options → provider). */
  readonly reduceMotion: boolean;
  /** @internal the pages container element. */
  readonly container: () => HTMLElement | null | undefined;
}

/** The `SidebarPages` in scope. */
export const SidebarPagesContext = createContext<SidebarPagesState | null>(null);

/** The active page value. */
export const sidebarPagesValue = (state: SidebarPagesState): string | undefined => state.control.value() ?? state.first();

/** Shows the page `value` (calls `onValueChange`; a plain controlled `value` only calls it). */
export function setSidebarPage(state: SidebarPagesState, value: string): void {
  untrack(() => {
    if ((controlledValue(state.control) ?? state.first()) === value) return;
    setControlledValue(state.control, value);
  });
}

/** `useSidebarPages()`: the nearest `SidebarPages` (throws outside one). */
export interface SidebarPagesContextValue {
  /** The active page value. */
  activeValue: () => string | undefined;
  /** Shows a page (drill in / back). */
  setActiveValue: (value: string) => void;
  /** Index of the active page in DOM order (`-1` before the pages render in the browser / on the server). */
  activeIndex: () => number;
  /** Page values in DOM order (empty on the server). */
  order: () => string[];
}

/** The page switcher of the nearest `SidebarPages`: accessors + setter (handlers resume). */
export function useSidebarPages(): SidebarPagesContextValue {
  const state = useContext(SidebarPagesContext);
  if (!state) throw new Error("useSidebarPages must be used within SidebarPages.");
  return {
    activeValue: () => sidebarPagesValue(state),
    setActiveValue: (value: string) => setSidebarPage(state, value),
    activeIndex: () => sidebarPageOrder(state).indexOf(sidebarPagesValue(state) ?? ""),
    order: () => sidebarPageOrder(state),
  };
}

const pageElements = (container: Element): HTMLElement[] =>
  Array.from(container.children).filter((c): c is HTMLElement => c.getAttribute("data-slot") === "sidebar-page");

function sidebarPageOrder(state: SidebarPagesState): string[] {
  const container = untrack(state.container);
  return container ? pageElements(container).map((p) => p.getAttribute("data-value") ?? "") : [];
}

// =================================================================================================
// SidebarPages
// =================================================================================================

export interface SidebarPagesProps {
  /** The active page (controlled): a value, a two-way Signal or an accessor. */
  value?: string | Signal<string> | (() => string);
  /** The page shown first (uncontrolled). @default the first page */
  defaultValue?: string;
  /** Called with the new page value on every switch. */
  onValueChange?: (value: string) => void;
  /** No slide animation (instant switch). @default inherited from the menu / group / provider */
  reduceMotion?: boolean;
  /** @default "rv-SidebarPages" */
  class?: ClassNameOrFunction<{}>;
  style?: StyleObject;
  id?: string;
  "aria-label"?: string;
  children?: Content;
  ref?: RefValue<HTMLDivElement>;
}

/** Rivet: an animated page switcher inside the sidebar (drill-in / back); pages are `SidebarPage value`. */
export function SidebarPages(props: SidebarPagesProps) {
  const { value, defaultValue, onValueChange, reduceMotion, class: cls, style, id, children, ref } = props;
  const sidebar = useContext(SidebarContext);
  const inheritedReduce = useContext(SidebarMenuOptionsContext)?.reduceMotion;
  const ariaLabel = props["aria-label"];
  const reduce = reduceMotion ?? inheritedReduce ?? sidebar?.reduceMotion ?? false;
  const state: SidebarPagesState = {
    control: controllable<string | undefined>(value as never, defaultValue, onValueChange as never),
    first: signal<string | undefined>(undefined),
    reduceMotion: reduce,
    container: createRef<HTMLDivElement>(),
  };
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarPages" });
  const refs = mergeRefValues(state.container as RefValue<HTMLDivElement>, ref);
  return (
    <div
      ref={refs as never}
      id={id}
      aria-label={ariaLabel}
      data-slot="sidebar-pages"
      data-sidebar="pages"
      data-reduce-motion={dataBool(reduce)}
      class={rp.class()}
      style={{ display: "grid", overflow: "hidden", ...style }}
    >
      {provide(SidebarPagesContext, state, () => rp.children())}
    </div>
  );
}

// =================================================================================================
// SidebarPage
// =================================================================================================

export interface SidebarPageProps {
  /** The page's value (`SidebarPages` `value`). */
  value: string;
  /** @default "rv-SidebarPage" */
  class?: ClassNameOrFunction<{}>;
  style?: StyleObject;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Content;
}

/** One page of `SidebarPages`; inactive pages are `hidden`, `inert` and `aria-hidden`. */
export function SidebarPage(props: SidebarPageProps) {
  const state = useContext(SidebarPagesContext);
  if (!state) throw new Error("SidebarPage must be rendered inside SidebarPages.");
  const { value, class: cls, style, id, children } = props;
  const ariaLabel = props["aria-label"],
    ariaLabelledby = props["aria-labelledby"];
  // No `value` / `defaultValue`: the first page rendered is the active one.
  if (untrack(state.control.value) === undefined && untrack(state.first) === undefined) state.first.set(value);
  const pageRef = createRef<HTMLDivElement>();
  const rp = renderProps({ class: cls, children, values: NONE, defaultClassName: "rv-SidebarPage" });
  return (
    <div
      ref={pageRef}
      id={id}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      data-slot="sidebar-page"
      data-sidebar="page"
      data-value={value}
      data-active={dataBool(sidebarPagesValue(state) === value)}
      class={rp.class()}
      style={{ "grid-area": "1 / 1", "min-inline-size": "0", ...style }}
      hidden={sidebarPageHidden(state, value, pageRef) as never}
      inert={sidebarPagesValue(state) === value ? undefined : (true as never)}
      aria-hidden={sidebarPagesValue(state) === value ? undefined : "true"}
    >
      {rp.children()}
    </div>
  );
}

// =================================================================================================
// Transition
// =================================================================================================

// Last shown page per container (initialised from the DOM on the first change), scheduled containers, running motions.
const shown = new WeakMap<Element, string | undefined>();
const scheduled = new WeakSet<Element>();
const running = new WeakMap<Element, () => void>();

/**
 * The page's `hidden` value (binding): static on the server / first read; on a change in the browser the leaving page
 * stays visible while it slides out (the transition hides it), and the transition is scheduled.
 */
export function sidebarPageHidden(state: SidebarPagesState, value: string, pageRef: () => HTMLElement | null | undefined): true | undefined {
  const active = sidebarPagesValue(state) === value;
  const page = untrack(pageRef);
  const container = page?.parentElement;
  if (!page || !container) return active ? undefined : true;
  if (!shown.has(container))
    shown.set(
      container,
      pageElements(container)
        .find((p) => !p.hasAttribute("hidden"))
        ?.getAttribute("data-value") ?? undefined,
    );
  if (!scheduled.has(container)) {
    scheduled.add(container);
    queueMicrotask(() => {
      scheduled.delete(container);
      sidebarPagesTransition(container, state);
    });
  }
  if (active) return undefined;
  // The page shown so far slides out first (the transition sets `hidden` when it settles).
  return value === shown.get(container) && !page.hasAttribute("hidden") ? undefined : true;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Runs the page switch of `container`: slide (Motion1D) or an instant switch. */
function sidebarPagesTransition(container: HTMLElement, state: SidebarPagesState): void {
  const now = untrack(() => sidebarPagesValue(state));
  const previous = shown.get(container);
  shown.set(container, now);
  running.get(container)?.();
  const pages = pageElements(container);
  const enter = pages.find((p) => p.getAttribute("data-value") === now);
  const leave = previous !== now ? pages.find((p) => p.getAttribute("data-value") === previous) : undefined;
  for (const page of pages) if (page !== enter && page !== leave && !page.hasAttribute("hidden")) page.setAttribute("hidden", "");
  if (!enter) return leave?.setAttribute("hidden", "");
  const doc = container.ownerDocument;
  const hadFocus = !!leave && leave.contains(doc.activeElement);
  enter.removeAttribute("hidden");
  const moveFocus = () => hadFocus && (enter.querySelector<HTMLElement>(FOCUSABLE) ?? enter).focus({ preventScroll: true });
  if (!leave) return;
  const width = container.getBoundingClientRect().width || enter.offsetWidth;
  if (state.reduceMotion || sidebarReducedMotion(false) || width <= 0) {
    leave.setAttribute("hidden", "");
    moveFocus();
    return;
  }
  const rtl = doc.defaultView?.getComputedStyle(container).direction === "rtl";
  const dir = (pages.indexOf(enter) > pages.indexOf(leave) ? 1 : -1) * (rtl ? -1 : 1);
  leave.style.pointerEvents = "none";
  const render = (v: number): void => {
    // The sub-pixel tail of the settle is invisible: done within half a pixel.
    if (width - v < 0.5) return finish();
    enter.style.transform = `translateX(${dir * (width - v)}px)`;
    leave.style.transform = `translateX(${-dir * v}px)`;
  };
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    motion.stop();
    running.delete(container);
    enter.style.transform = "";
    leave.style.transform = "";
    leave.style.pointerEvents = "";
    if (untrack(() => sidebarPagesValue(state)) !== leave.getAttribute("data-value")) leave.setAttribute("hidden", "");
  };
  const motion = Motion1D({ value: 0, render, onSettle: finish });
  running.set(container, finish);
  render(0);
  motion.to(width);
  moveFocus();
}
