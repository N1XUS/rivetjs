// Rivet extension (no shadcn/ui counterpart: shadcn's SidebarRail only toggles): a drag-resizable Sidebar.
// Behaviour of the WAI-ARIA window splitter (https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) as in
// `@rivetjs/cdk/resizable` (react-resizable-panels 4.14.3: pointer capture drag, arrows / Home / End / Enter, double-click
// reset, collapse below the minimum), on the fixed shadcn panel: the width is the `--sidebar-width` CSS variable on the
// Sidebar root (gap + container read it), not a flex panel of a Group (`libs/ui/CLAUDE.md` AppLayout ruling 2026-10-08).
// - state = plain data in the region state (`controllable` width, bounds, the caller's handlers): handlers resume;
//   per-drag data lives in a module WeakMap keyed by the handle (browser only, never serialized).
// - dragging below half the minimum collapses the sidebar (`setSidebarOpen(false)`: `onOpenChange` + cookie; the
//   `collapsible` mode picks offcanvas / icon) and dragging back out re-opens it; the open / close snap is the
//   sidebar's own CSS collapse transition (200 ms ease-out-quad), off for the plain width changes of a drag
//   (`data-resizing` on the root).
import { untrack, _regionState, type Signal } from "@rivetjs/reactivity";
import { controllable, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { setSidebarOpen, type SidebarState } from "./state.ts";

/** A sidebar width: a number = px, a string = a CSS length (`"18rem"`, `"280px"`, `"20vw"`). */
export type SidebarWidth = number | string;

/** Default `minWidth` / `maxWidth` of a resizable Sidebar. */
export const SIDEBAR_MIN_WIDTH = "12rem";
export const SIDEBAR_MAX_WIDTH = "28rem";
/** Default keyboard step (px; Shift: × 5). */
export const SIDEBAR_RESIZE_STEP = 16;

export interface SidebarResizeProps {
  /**
   * Width (controlled): a value, a two-way Signal or an accessor. `undefined` = the provider's `--sidebar-width`.
   * A Signal follows every drag move; a plain value / accessor only calls `onWidthChange`.
   */
  width?: SidebarWidth | Signal<SidebarWidth | undefined> | (() => SidebarWidth | undefined);
  /** Initial width (uncontrolled). @default the provider's `--sidebar-width` (16rem) */
  defaultWidth?: SidebarWidth;
  /** Called on every width change (each drag move, key, reset) with the width in px. */
  onWidthChange?: (width: number) => void;
  /** Called once a resize ends (pointer up, a key, double-click reset) with the width in px: persist here. */
  onWidthChangeEnd?: (width: number) => void;
  /** @default "12rem" */
  minWidth?: SidebarWidth;
  /** @default "28rem" */
  maxWidth?: SidebarWidth;
  /** Dragging below half of `minWidth` collapses the sidebar (`collapsible` mode); dragging back out re-opens it. @default true */
  collapseBelowMin?: boolean;
  /** Arrow key step in px (Shift: × 5). @default 16 */
  resizeStep?: number;
}

/** Resize state of one Sidebar (serializable). */
export interface SidebarResizeState {
  /** The width; `undefined` = the provider's `--sidebar-width`. */
  readonly control: ControlledState<SidebarWidth | undefined, number>;
  readonly defaultWidth: SidebarWidth | undefined;
  readonly min: SidebarWidth;
  readonly max: SidebarWidth;
  readonly collapseBelowMin: boolean;
  readonly step: number;
  readonly onWidthChangeEnd: ((width: number) => void) | undefined;
}

export function createSidebarResizeState(props: SidebarResizeProps): SidebarResizeState {
  return _regionState(() => ({
    control: controllable<SidebarWidth | undefined, number>(props.width as never, props.defaultWidth, props.onWidthChange),
    defaultWidth: props.defaultWidth,
    min: props.minWidth ?? SIDEBAR_MIN_WIDTH,
    max: props.maxWidth ?? SIDEBAR_MAX_WIDTH,
    collapseBelowMin: props.collapseBelowMin ?? true,
    step: props.resizeStep ?? SIDEBAR_RESIZE_STEP,
    onWidthChangeEnd: props.onWidthChangeEnd,
  }));
}

/** The width as CSS (`undefined`: no override). */
export const sidebarWidthCss = (width: SidebarWidth | undefined): string | undefined =>
  width == null ? undefined : typeof width === "number" ? `${width}px` : width;

/**
 * A length in px: numbers, `px`, `rem` (root font size; 16 on the server), `em` (font size of `el`), `vw` / `%` (of the
 * viewport); `NaN` when unparsable.
 */
export function sidebarLengthPx(size: SidebarWidth, el?: Element | null): number {
  if (typeof size === "number") return size;
  const m = /^\s*(-?[\d.]+)\s*(px|rem|em|vw|%)?\s*$/.exec(size);
  if (!m) return NaN;
  const n = parseFloat(m[1]!);
  const unit = m[2] ?? "px";
  if (unit === "px") return n;
  if (typeof window === "undefined") return unit === "rem" || unit === "em" ? n * 16 : NaN;
  if (unit === "vw" || unit === "%") return (n / 100) * window.innerWidth;
  const of = unit === "em" && el ? el : document.documentElement;
  return n * (parseFloat(getComputedStyle(of).fontSize) || 16);
}

/** `aria-valuenow` (px, rounded): the set width, `undefined` while it is the provider's variable (filled in on focus / drag). */
export function sidebarWidthNow(rs: SidebarResizeState): number | undefined {
  const width = rs.control.value();
  if (width == null) return undefined;
  const px = sidebarLengthPx(width);
  return Number.isFinite(px) ? Math.round(px) : undefined;
}

/** `aria-valuemin` / `aria-valuemax` (px, rounded; `undefined` when not computable on the server). */
export function sidebarBoundPx(size: SidebarWidth): number | undefined {
  const px = sidebarLengthPx(size);
  return Number.isFinite(px) ? Math.round(px) : undefined;
}

interface Drag {
  pointerId: number;
  startX: number;
  startWidth: number;
  dir: 1 | -1;
  /** Until then a collapse / expand snap animates (no `data-resizing`). */
  snapUntil: number;
  moved: boolean;
}
const drags = new WeakMap<Element, Drag>();
const SNAP_MS = 220;

const rootOf = (handle: Element): HTMLElement | null => handle.closest('[data-slot="sidebar"]');
const containerOf = (handle: Element): HTMLElement | null => handle.closest('[data-slot="sidebar-container"]');

/** +1 when moving the pointer right grows the panel (left side LTR, right side RTL), else -1. */
function growDirection(root: HTMLElement): 1 | -1 {
  const rtl = getComputedStyle(root).direction === "rtl";
  return (root.getAttribute("data-side") !== "right") !== rtl ? 1 : -1;
}

/** The expanded width in px right now (set width, else the inherited `--sidebar-width`, else the container box). */
function currentWidth(rs: SidebarResizeState, handle: Element): number {
  const root = rootOf(handle);
  const set = untrack(rs.control.value);
  let px = set == null ? NaN : sidebarLengthPx(set, root);
  if (!Number.isFinite(px) && root) px = sidebarLengthPx(getComputedStyle(root).getPropertyValue("--sidebar-width").trim(), root);
  if (!Number.isFinite(px)) px = containerOf(handle)?.getBoundingClientRect().width ?? 0;
  return px;
}

function bounds(rs: SidebarResizeState, handle: Element): [number, number] {
  const root = rootOf(handle);
  const lo = sidebarLengthPx(rs.min, root);
  const hi = sidebarLengthPx(rs.max, root);
  const min = Number.isFinite(lo) ? lo : 0;
  return [min, Number.isFinite(hi) ? Math.max(min, hi) : Infinity];
}

function setWidth(rs: SidebarResizeState, px: number): void {
  setControlledValue(rs.control, Math.round(px));
}

function commit(rs: SidebarResizeState, handle: Element): void {
  rs.onWidthChangeEnd?.(Math.round(currentWidth(rs, handle)));
}

/** Writes `aria-valuenow` while the width is still the provider's variable (the binding owns it once a width is set). */
function syncValueNow(rs: SidebarResizeState, handle: Element): void {
  if (untrack(rs.control.value) == null) handle.setAttribute("aria-valuenow", String(Math.round(currentWidth(rs, handle))));
}

/** Handle `focus` / `pointerover`: fills in `aria-valuenow`. */
export function sidebarResizeSync(event: Event, rs: SidebarResizeState): void {
  syncValueNow(rs, event.currentTarget as Element);
}

/** Handle `pointerdown`: starts a drag (primary button / touch / pen), pointer captured. */
export function sidebarResizePointerDown(event: PointerEvent, s: SidebarState, rs: SidebarResizeState): void {
  if (event.button !== 0) return;
  const handle = event.currentTarget as HTMLElement;
  const root = rootOf(handle);
  if (!root) return;
  event.preventDefault();
  const open = untrack(s.open);
  syncValueNow(rs, handle);
  drags.set(handle, {
    pointerId: event.pointerId,
    startX: event.clientX,
    // Collapsed (icon rail): the drag starts from the rail's width.
    startWidth: open ? currentWidth(rs, handle) : (containerOf(handle)?.getBoundingClientRect().width ?? 0),
    dir: growDirection(root),
    snapUntil: 0,
    moved: false,
  });
  try {
    handle.setPointerCapture(event.pointerId);
  } catch {
    // not an active pointer (synthetic event): the drag still follows events on the handle
  }
  handle.setAttribute("data-dragging", "true");
}

/** Handle `pointermove`: resizes (clamped), collapses below half the minimum, re-opens above it. */
export function sidebarResizePointerMove(event: PointerEvent, s: SidebarState, rs: SidebarResizeState): void {
  const handle = event.currentTarget as HTMLElement;
  const drag = drags.get(handle);
  if (!drag || drag.pointerId !== event.pointerId) return;
  const root = rootOf(handle);
  if (!root) return;
  const raw = drag.startWidth + (event.clientX - drag.startX) * drag.dir;
  if (!drag.moved && Math.abs(event.clientX - drag.startX) < 1) return;
  drag.moved = true;
  const [min, max] = bounds(rs, handle);
  const open = untrack(s.open);
  const now = performance.now();
  if (rs.collapseBelowMin && raw < min / 2) {
    if (open) {
      root.removeAttribute("data-resizing");
      drag.snapUntil = now + SNAP_MS;
      setSidebarOpen(s, false);
    }
    return;
  }
  if (!open) {
    root.removeAttribute("data-resizing");
    drag.snapUntil = now + SNAP_MS;
    setSidebarOpen(s, true);
  }
  if (now >= drag.snapUntil) root.setAttribute("data-resizing", "true");
  setWidth(rs, Math.min(max, Math.max(min, raw)));
}

/** Handle `pointerup` / `pointercancel` / `lostpointercapture`: ends the drag (`onWidthChangeEnd` when it moved). */
export function sidebarResizePointerUp(event: PointerEvent, rs: SidebarResizeState): void {
  const handle = event.currentTarget as HTMLElement;
  const drag = drags.get(handle);
  if (!drag || drag.pointerId !== event.pointerId) return;
  drags.delete(handle);
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  handle.removeAttribute("data-dragging");
  rootOf(handle)?.removeAttribute("data-resizing");
  if (drag.moved) commit(rs, handle);
}

/** The provider's `--sidebar-width` in px (`NaN` when not a plain length). */
function providerWidth(handle: Element): number {
  const wrapper = handle.closest('[data-slot="sidebar-wrapper"]');
  return wrapper ? sidebarLengthPx(getComputedStyle(wrapper).getPropertyValue("--sidebar-width").trim(), wrapper) : NaN;
}

/** Handle `dblclick`: back to `defaultWidth` (else the provider's `--sidebar-width`), opening a collapsed sidebar. */
export function sidebarResizeReset(event: MouseEvent, s: SidebarState, rs: SidebarResizeState): void {
  const handle = event.currentTarget as HTMLElement;
  const fallback = providerWidth(handle);
  setControlledValue(rs.control, rs.defaultWidth ?? (Number.isFinite(fallback) ? Math.round(fallback) : undefined));
  if (!untrack(s.open)) setSidebarOpen(s, true);
  commit(rs, handle);
}

/**
 * Handle `keydown` (window splitter): Arrow Left / Right ± `resizeStep` px (Shift × 5; mirrored for a right sidebar and
 * RTL), Home / End = min / max, Enter toggles collapse. A growing key on a collapsed sidebar opens it.
 */
export function sidebarResizeKeyDown(event: KeyboardEvent, s: SidebarState, rs: SidebarResizeState): void {
  const handle = event.currentTarget as HTMLElement;
  const root = rootOf(handle);
  if (!root || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key;
  if (key === "Enter") {
    event.preventDefault();
    setSidebarOpen(s, (open) => !open);
    return;
  }
  const [min, max] = bounds(rs, handle);
  const width = currentWidth(rs, handle);
  let next: number;
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const grow = (key === "ArrowRight" ? 1 : -1) * growDirection(root);
    next = width + grow * rs.step * (event.shiftKey ? 5 : 1);
    if (!untrack(s.open)) {
      event.preventDefault();
      if (grow > 0) setSidebarOpen(s, true);
      return;
    }
  } else if (key === "Home") next = min;
  else if (key === "End") next = max;
  else return;
  event.preventDefault();
  if (!untrack(s.open)) setSidebarOpen(s, true);
  setWidth(rs, Math.min(max, Math.max(min, next)));
  commit(rs, handle);
}
