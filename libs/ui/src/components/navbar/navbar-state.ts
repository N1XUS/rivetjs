// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no navbar). Feature set (props, defaults) inspired by HeroUI Pro's
// public Navbar docs; independent implementation. Serializable navbar state (plain data + signals + the caller's
// callbacks), region state so a re-created region of a resumed page keeps it; free functions take the state first.
import { controllable, controlledValue, setControlledValue, type ControlledState } from "@rivetjs/cdk/interactions";
import { _regionState, signal, untrack, type Signal } from "@rivetjs/reactivity";

export interface NavbarOptions {
  /** Hides the bar while scrolling down, reveals it on scroll up. @default false */
  hideOnScroll?: boolean;
  /** The scroll container watched by `hideOnScroll` (an element accessor, e.g. a `ref()`). @default the window */
  parentRef?: () => Element | null | undefined;
  /** Whether the mobile menu is open (controlled): a value, a two-way Signal or an accessor. */
  isMenuOpen?: boolean | Signal<boolean> | (() => boolean);
  /** @default false */
  defaultMenuOpen?: boolean;
  onMenuOpenChange?: (isOpen: boolean) => void;
  /** Locks the page scroll while the mobile menu is open. @default true */
  shouldBlockScroll?: boolean;
  /** Height of the bar (CSS length, `--navbar-height`). @default "4rem" */
  height?: string;
}

export interface NavbarState {
  readonly menu: ControlledState<boolean>;
  /** Hidden by the JS scroll fallback (`null`: the listener has not run; CSS scroll-state decides). */
  readonly hidden: Signal<boolean | null>;
  /** Last scroll offset seen by the listener. */
  readonly lastY: Signal<number>;
  readonly hideOnScroll: boolean;
  readonly shouldBlockScroll: boolean;
  readonly height: string;
  readonly menuId: string;
  readonly parentRef: NavbarOptions["parentRef"];
}

export function createNavbarState(options: NavbarOptions, menuId: string): NavbarState {
  return _regionState(() => ({
    menu: controllable<boolean>(options.isMenuOpen, !!options.defaultMenuOpen, options.onMenuOpenChange),
    hidden: signal<boolean | null>(null),
    lastY: signal(0),
    hideOnScroll: !!options.hideOnScroll,
    shouldBlockScroll: options.shouldBlockScroll ?? true,
    height: options.height ?? "4rem",
    menuId,
    parentRef: options.parentRef,
  }));
}

export function setNavbarMenuOpen(state: NavbarState, open: boolean): void {
  untrack(() => setControlledValue(state.menu, open));
}

export function toggleNavbarMenu(state: NavbarState): void {
  setNavbarMenuOpen(state, !untrack(() => controlledValue(state.menu)));
}

/** Movement (px) a scroll must make in one direction before the bar hides / shows. */
const SCROLL_DELTA = 4;

/** Scroll listener (JS fallback / `parentRef`): hide while scrolling down past the bar, show on scroll up. */
export function navbarScrolled(state: NavbarState, nav: Element | null, event: Event): void {
  const parent = state.parentRef?.();
  const target = event.target;
  const doc = nav?.ownerDocument;
  if (!doc) return;
  let y: number;
  if (parent) {
    if (target !== parent) return;
    y = (parent as HTMLElement).scrollTop;
  } else {
    if (target !== doc && target !== doc.documentElement && target !== doc.scrollingElement) return;
    y = doc.defaultView?.scrollY ?? 0;
  }
  const last = untrack(state.lastY);
  if (Math.abs(y - last) < SCROLL_DELTA) return;
  const barHeight = (nav as HTMLElement).offsetHeight || 0;
  const hide = y > last && y > barHeight && !untrack(() => controlledValue(state.menu));
  state.lastY.set(y);
  if (untrack(state.hidden) !== hide) state.hidden.set(hide);
}
