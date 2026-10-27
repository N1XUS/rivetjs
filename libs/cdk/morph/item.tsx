// Rivet-authored (no upstream): item morph — a collection item (ListBox option, GridList row, Menu item, any element)
// lifts out of its list into a panel (preview, settings, actions) on the shared div overlay layer, iOS context-menu
// style: press and hold shrinks the row slightly, at the threshold the surface morphs from the row's box to the panel's
// box over a dimmed backdrop, closing morphs it back into the row. Motion = `morphRectTo` (`./index.tsx`, house motion
// `Motion1D`: interruptible, reduced motion jumps).
//
// - One `ItemMorph` per list (`createItemMorph`): every item spreads `itemMorphProps(morph)`, one `<ItemMorphPanel>`
//   renders the panel for the item that opened it (render-function children get the item's key). Plain data + signals:
//   it serializes, so the handlers resume; nothing runs at load.
// - Triggers (`trigger`, one or a list): "longPress" (default; mouse + touch, `threshold` 500 ms = React Aria
//   useLongPress, movement > 10 px / scroll / leaving cancels), "contextMenu" (right click, touch long press),
//   "press" (the item's action: ListBox / GridList / Menu `onAction`), "doubleClick", "none" (programmatic / controlled
//   only). Keyboard for every trigger but "none": the ContextMenu key and Shift+F10 (the platform "open context menu"
//   keys; WAI-ARIA APG).
// - A long press cancels the item's own press like useLongPress (a bubbling `pointercancel` at the threshold, the next
//   `click` prevented) and marks the item `data-rv-long-press`, which makes a cdk ListBox select it on press up (mouse
//   presses select on press down otherwise, before a hold can be told apart from a click): a long press never selects or
//   acts.
// - Resumable chunk timing: the panel content renders hidden (`phase` 1, primed) 120 ms into a hold, so its code is in
//   by the threshold; a tap renders nothing.
// - A11y: the surface is `role="dialog"` `aria-modal="true"`, named by the item (`aria-labelledby` = the item id) unless
//   `aria-label` is given; focus moves in (`[data-morph-autofocus]`, else the first tabbable, else the surface); the
//   rest of the page is `inert` (`ariaHideOutside`) and scroll is locked (`preventScroll`) while open; Escape, a press
//   on the backdrop and `closeItemMorph` close it and return focus to the item (list keyboard navigation continues from
//   there).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { tabbables } from "../a11y/index.ts";
import type { Key } from "../collections/types.ts";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { ariaHideOutside } from "../overlay/aria-hide-outside.ts";
import { preventScroll } from "../overlay/prevent-scroll.ts";
import { Portal } from "../portal/index.tsx";
import { getOwnerDocument, getOwnerWindow } from "../utils/dom-core.ts";
import { createId } from "../utils/id.ts";
import { morphRectTo, morphReducesMotion, type MorphMotionOptions, type MorphRect } from "./index.tsx";

/** What opens an item morph. */
export type ItemMorphTrigger = "longPress" | "contextMenu" | "press" | "doubleClick" | "none";

export interface ItemMorphOptions extends MorphMotionOptions {
  /** What opens the panel (one trigger or several). Keyboard: ContextMenu key / Shift+F10 unless "none". @default "longPress" */
  trigger?: ItemMorphTrigger | ItemMorphTrigger[];
  /** Hold time of a long press (ms). @default 500 */
  threshold?: number;
  /** The open item's key (controlled; `null` = closed): a value, a two-way Signal or an accessor. */
  openKey?: Key | null | Signal<Key | null> | (() => Key | null);
  /** Called with the item's key when the panel opens and with `null` when it closes. */
  onOpenChange?: (key: Key | null) => void;
  /** Disables every trigger. */
  isDisabled?: boolean;
}

/** Item morph state: plain data + signals (serializable; captured by the item handlers and the panel). */
export interface ItemMorph {
  readonly id: string;
  /** Space-separated triggers. */
  readonly triggers: string;
  readonly threshold: number;
  readonly isDisabled: boolean;
  readonly duration: number | undefined;
  readonly friction: number | undefined;
  /** The open item's key (`null`: closed). */
  readonly open: ControlledState<Key | null>;
  /** The item the panel renders for (set when a hold primes it, kept through the close). */
  readonly key: Signal<Key | null>;
  /** 0 idle, 1 primed (rendered hidden), 2 open / opening, 3 closing. */
  readonly phase: Signal<number>;
}

/** Long press threshold (React Aria useLongPress default). */
export const ITEM_MORPH_THRESHOLD = 500;
/** A hold renders the panel (hidden) after this long, so its code is loaded by the threshold. */
const PRIME_DELAY = 120;
/** Pointer movement that cancels a hold (px). */
const MOVE_TOLERANCE = 10;
/** Viewport margin of the panel (px). */
const MARGIN = 16;

/** Creates the morph shared by a list's items. */
export function createItemMorph(options: ItemMorphOptions = {}): ItemMorph {
  const trigger = options.trigger ?? "longPress";
  return {
    id: createId(),
    triggers: (Array.isArray(trigger) ? trigger : [trigger]).join(" "),
    threshold: options.threshold ?? ITEM_MORPH_THRESHOLD,
    isDisabled: options.isDisabled === true,
    duration: options.duration,
    friction: options.friction,
    open: controllable<Key | null>(options.openKey, null, options.onOpenChange),
    key: signal<Key | null>(null),
    phase: signal(0),
  };
}

const has = (m: ItemMorph, trigger: ItemMorphTrigger): boolean => (" " + m.triggers + " ").includes(" " + trigger + " ");

/**
 * Props for each item element (spread on `ListBoxItem` / `GridListItem` / `MenuItem` or a custom element): the trigger
 * handlers for `morph.triggers`, `data-rv-morph` (finds the item) and `data-rv-long-press` (a cdk ListBox selects it on
 * press up). ListBox items get `onKeyDown` through the item's own prop (React Aria useKeyboard: unhandled keys continue).
 */
export function itemMorphProps(m: ItemMorph): Record<string, unknown> {
  const bag: Record<string, unknown> = {
    "data-rv-morph": m.id,
    onPointerDown: (e: PointerEvent) => itemMorphPointerDown(m, e),
    onKeyDown: (e: KeyboardEvent) => itemMorphKeyDown(m, e),
    // Touch long presses open the native context menu (and contextMenu triggers it on purpose).
    onContextMenu: (e: MouseEvent) => itemMorphContextMenu(m, e),
  };
  if (has(m, "longPress") || has(m, "contextMenu")) Object.assign(bag, { "data-rv-long-press": "" });
  if (has(m, "doubleClick")) Object.assign(bag, { onDblClick: (e: MouseEvent) => itemMorphDoubleClick(m, e) });
  if (has(m, "press")) Object.assign(bag, { onAction: () => itemMorphAction(m) });
  return bag;
}

// ---------------------------------------------------------------------------------------------
// Browser state (never serialized): per morph id
// ---------------------------------------------------------------------------------------------

interface Hold {
  item: HTMLElement;
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
  t0: number;
  fired: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
  prime: ReturnType<typeof setTimeout> | undefined;
  raf: number;
  remove: (() => void)[];
}

interface Live {
  /** The item that opened the panel. */
  item: HTMLElement | null;
  /** The item pressed last (pointer / key): the "press" trigger's source. */
  pressed: HTMLElement | null;
  surface: HTMLElement | null;
  backdrop: HTMLElement | null;
  host: HTMLElement | null;
  hold: Hold | null;
  /** Releases inert / scroll lock / dismiss listeners of the open panel. */
  release: (() => void)[];
  /** Ignore the `pointercancel` the threshold dispatches. */
  synthetic: boolean;
}

const lives = new Map<string, Live>();
const liveOf = (m: ItemMorph): Live => {
  let l = lives.get(m.id);
  if (!l) lives.set(m.id, (l = { item: null, pressed: null, surface: null, backdrop: null, host: null, hold: null, release: [], synthetic: false }));
  return l;
};

const sourceOf = (m: ItemMorph, e: Event): HTMLElement | null => {
  const t = e.target;
  return t instanceof Element ? (t.closest(`[data-rv-morph="${m.id}"]`) as HTMLElement | null) : null;
};

/** The item's collection key (`data-key`, numeric with `data-key-type="number"`), else its id. */
function keyOf(item: HTMLElement): Key {
  const key = item.getAttribute("data-key");
  if (key == null) return item.id;
  return item.getAttribute("data-key-type") === "number" ? Number(key) : key;
}

const isDisabledItem = (item: HTMLElement): boolean => item.getAttribute("aria-disabled") === "true" || item.hasAttribute("data-disabled");

const raf = (f: () => void): number => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(f) : (setTimeout(f, 16) as unknown as number));
const caf = (id: number): void => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id));

// ---------------------------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------------------------

/** @internal pointerdown on an item: long press hold (longPress; contextMenu on touch). */
export function itemMorphPointerDown(m: ItemMorph, e: PointerEvent): void {
  const item = sourceOf(m, e);
  if (!item) return;
  const l = liveOf(m);
  l.pressed = item;
  if (m.isDisabled || isDisabledItem(item) || untrack(m.phase) === 2) return;
  const touch = e.pointerType === "touch" || e.pointerType === "pen";
  if (!(has(m, "longPress") || (touch && has(m, "contextMenu")))) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  startHold(m, l, item, e);
}

function startHold(m: ItemMorph, l: Live, item: HTMLElement, e: PointerEvent): void {
  endHold(m, l, false);
  const win = getOwnerWindow(item);
  const hold: Hold = {
    item,
    pointerId: e.pointerId,
    pointerType: e.pointerType,
    x: e.clientX,
    y: e.clientY,
    t0: performance.now(),
    fired: false,
    timer: undefined,
    prime: undefined,
    raf: 0,
    remove: [],
  };
  l.hold = hold;
  const listen = (target: EventTarget, type: string, fn: (ev: Event) => void, opts?: boolean | AddEventListenerOptions): void => {
    target.addEventListener(type, fn, opts);
    hold.remove.push(() => target.removeEventListener(type, fn, opts));
  };
  const cancel = (): void => {
    if (!hold.fired) endHold(m, l, true);
  };
  listen(win, "pointerup", (ev) => (ev as PointerEvent).pointerId === hold.pointerId && cancel(), true);
  listen(win, "pointercancel", (ev) => !l.synthetic && (ev as PointerEvent).pointerId === hold.pointerId && cancel(), true);
  listen(win, "scroll", cancel, true);
  listen(win, "pointermove", (ev) => {
    const p = ev as PointerEvent;
    if (p.pointerId === hold.pointerId && Math.hypot(p.clientX - hold.x, p.clientY - hold.y) > MOVE_TOLERANCE) cancel();
  });
  // The page's text selection / iOS callout must not start under the finger.
  const s = item.style as CSSStyleDeclaration & { webkitTouchCallout?: string };
  const callout = s.webkitTouchCallout ?? "";
  const select = s.userSelect;
  s.webkitTouchCallout = "none";
  s.userSelect = "none";
  hold.remove.push(() => {
    s.webkitTouchCallout = callout;
    s.userSelect = select;
  });
  hold.prime = setTimeout(() => prime(m, item), PRIME_DELAY);
  // Press-and-hold feedback: `--morph-hold` 0 → 1 (ease out) on the item while held (the stylesheet scales it).
  if (!morphReducesMotion(item)) {
    item.setAttribute("data-morph-holding", "");
    const frame = (): void => {
      const t = Math.min(1, Math.max(0, (performance.now() - hold.t0 - 80) / Math.max(1, m.threshold - 80)));
      item.style.setProperty("--morph-hold", String(Math.round((1 - (1 - t) ** 3) * 1e3) / 1e3));
      if (t < 1 && l.hold === hold) hold.raf = raf(frame);
    };
    hold.raf = raf(frame);
  }
  hold.timer = setTimeout(() => {
    hold.fired = true;
    // useLongPress: stop the item's other press handlers (selection / action) from handling this press.
    l.synthetic = true;
    try {
      item.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: hold.pointerId, pointerType: hold.pointerType }));
    } finally {
      l.synthetic = false;
    }
    // No click action after a long press (dropped after the pointer is up, as useLongPress).
    const noClick = (ev: Event): void => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    item.addEventListener("click", noClick, { capture: true, once: true });
    win.addEventListener("pointerup", () => setTimeout(() => item.removeEventListener("click", noClick, { capture: true }), 100), {
      once: true,
      capture: true,
    });
    if (hold.pointerType === "touch") item.addEventListener("contextmenu", (ev) => ev.preventDefault(), { once: true });
    endHold(m, l, false);
    openItemMorph(m, item);
  }, m.threshold);
}

function endHold(m: ItemMorph, l: Live, unprime: boolean): void {
  const hold = l.hold;
  if (!hold) return;
  l.hold = null;
  clearTimeout(hold.timer);
  clearTimeout(hold.prime);
  caf(hold.raf);
  for (const remove of hold.remove.splice(0)) remove();
  hold.item.removeAttribute("data-morph-holding");
  hold.item.style.removeProperty("--morph-hold");
  if (unprime && untrack(m.phase) === 1) m.phase.set(0);
}

/** Renders the panel hidden for `item` (its code loads while the hold runs). */
function prime(m: ItemMorph, item: HTMLElement): void {
  if (untrack(m.phase) !== 0) return;
  m.key.set(keyOf(item));
  m.phase.set(1);
}

/** @internal contextmenu on an item. */
export function itemMorphContextMenu(m: ItemMorph, e: MouseEvent): void {
  const item = sourceOf(m, e);
  if (!item) return;
  const l = liveOf(m);
  const holdingTouch = l.hold?.item === item && l.hold.pointerType !== "mouse";
  if (holdingTouch) e.preventDefault();
  if (!has(m, "contextMenu") || m.isDisabled || isDisabledItem(item)) return;
  e.preventDefault();
  if (untrack(m.phase) === 2) return;
  endHold(m, l, false);
  openItemMorph(m, item);
}

/** @internal keydown on an item: ContextMenu key / Shift+F10 open it; other keys continue (useKeyboard). */
export function itemMorphKeyDown(m: ItemMorph, e: KeyboardEvent): void {
  const item = sourceOf(m, e);
  const opens = e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey);
  if (!item || !opens || has(m, "none") || m.isDisabled || isDisabledItem(item)) {
    if (item) liveOf(m).pressed = item;
    (e as KeyboardEvent & { continuePropagation?: () => void }).continuePropagation?.();
    return;
  }
  e.preventDefault();
  openItemMorph(m, item);
}

/** @internal dblclick on an item. */
export function itemMorphDoubleClick(m: ItemMorph, e: MouseEvent): void {
  const item = sourceOf(m, e);
  if (item && !m.isDisabled && !isDisabledItem(item)) openItemMorph(m, item);
}

/** @internal the item's action ("press" trigger): the item pressed last (pointer / key) or the focused one. */
export function itemMorphAction(m: ItemMorph): void {
  if (m.isDisabled || typeof document === "undefined") return;
  const l = liveOf(m);
  const active = getOwnerDocument().activeElement?.closest(`[data-rv-morph="${m.id}"]`) as HTMLElement | null;
  const item = l.pressed?.isConnected ? l.pressed : active;
  if (item) openItemMorph(m, item);
}

// ---------------------------------------------------------------------------------------------
// Open / close
// ---------------------------------------------------------------------------------------------

/** Opens the panel for `item` (an element carrying the morph's item props). */
export function openItemMorph(m: ItemMorph, item: HTMLElement): void {
  const key = keyOf(item);
  setControlledValue(m.open, key);
  // A read-only controlled value changes only when the caller says so (the panel's follower effect syncs).
  if (!m.open.isControlled || m.open.isSignal) syncItemMorph(m, key, item);
}

/** Closes the panel (focus back to the item unless `restoreFocus` is false). */
export function closeItemMorph(m: ItemMorph, restoreFocus = true): void {
  if (controlledValue(m.open) === null && untrack(m.phase) !== 2) return;
  setControlledValue(m.open, null);
  if (!m.open.isControlled || m.open.isSignal) syncItemMorph(m, null, null, restoreFocus);
}

/** Whether the panel is open for some item (tracked). */
export const isItemMorphOpen = (m: ItemMorph): boolean => m.open.value() !== null;

/** DOM + motion follow `key` (`null` = closed). `item` defaults to the element carrying the key. */
export function syncItemMorph(m: ItemMorph, key: Key | null, item?: HTMLElement | null, restoreFocus = true): void {
  if (typeof document === "undefined") return;
  const l = liveOf(m);
  const phase = untrack(m.phase);
  if (key === null) {
    if (phase === 2) beginClose(m, l, restoreFocus);
    else if (phase === 1) m.phase.set(0);
    return;
  }
  const source =
    item ??
    (Array.from(getOwnerDocument().querySelectorAll<HTMLElement>(`[data-rv-morph="${m.id}"]`)).find((el) => String(keyOf(el)) === String(key)) as
      HTMLElement | undefined) ??
    null;
  if (!source) return;
  if (phase === 2 && l.item === source) return;
  if (phase === 3 && l.item !== source && l.surface) {
    // Another item while one closes: finish that close at once.
    morphRectTo(l.surface, false, { from: () => itemRect(l.item), to: () => surfaceRect(l.surface!), jump: true });
  }
  if (phase === 2 && l.item !== source) {
    releaseOpen(l);
    l.item?.removeAttribute("data-morph-open");
  }
  l.item = source;
  if (untrack(m.key) !== key) m.key.set(key);
  m.phase.set(2);
  // Mounted already (primed, or closing): open now; else `itemMorphPlaced` opens once the panel is in the layer.
  if (l.surface) beginOpen(m, l);
}

/** @internal the panel is in the overlay layer (Portal `onPlaced`). */
export function itemMorphPlaced(m: ItemMorph, host: HTMLElement | undefined, surface: HTMLElement | undefined, backdrop: HTMLElement | undefined): void {
  if (!surface) return;
  const l = liveOf(m);
  l.host = host ?? surface.parentElement;
  l.surface = surface;
  l.backdrop = backdrop ?? null;
  if (untrack(m.phase) === 2) beginOpen(m, l);
}

/** @internal the panel left the overlay layer. */
export function itemMorphRemoved(m: ItemMorph, surface: HTMLElement | undefined): void {
  const l = lives.get(m.id);
  if (!l || l.surface !== surface) return;
  releaseOpen(l);
  l.surface = l.backdrop = l.host = null;
}

function cssPx(value: string, fallback: number): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/** The item's viewport box (transforms included: the held, slightly shrunk row) + its corner radius. */
function itemRect(item: HTMLElement | null): MorphRect {
  if (!item || !item.isConnected) return { x: innerWidth / 2 - 40, y: innerHeight / 2 - 20, w: 80, h: 40, r: 20 };
  const box = item.getBoundingClientRect();
  return { x: box.left, y: box.top, w: box.width, h: box.height, r: Math.min(cssPx(getComputedStyle(item).borderTopLeftRadius, 0), box.height / 2) };
}

function surfaceRect(surface: HTMLElement): MorphRect {
  const box = surface.getBoundingClientRect();
  return { x: box.left, y: box.top, w: box.width, h: box.height, r: cssPx(getComputedStyle(surface).borderTopLeftRadius, 0) };
}

/** Where the open panel rests: centred on the row horizontally, top at the row's top, kept inside the viewport. */
function panelRect(surface: HTMLElement, panel: HTMLElement, row: MorphRect): MorphRect {
  const vw = surface.ownerDocument.documentElement.clientWidth || innerWidth;
  const vh = innerHeight;
  const w = Math.min(panel.offsetWidth, vw - 2 * MARGIN);
  const h = Math.min(panel.offsetHeight, vh - 2 * MARGIN);
  const x = Math.min(Math.max(MARGIN, row.x + row.w / 2 - w / 2), vw - MARGIN - w);
  const y = Math.max(MARGIN, Math.min(row.y, vh - MARGIN - h));
  const r = Math.min(
    cssPx(getComputedStyle(surface).getPropertyValue("--morph-expanded-radius"), cssPx(getComputedStyle(surface).borderTopLeftRadius, 24)),
    w / 2,
    h / 2,
  );
  return { x, y, w, h, r };
}

const panelOf = (surface: HTMLElement): HTMLElement => surface.querySelector<HTMLElement>("[data-morph-expanded]") ?? surface;

/** The panel content keeps its open width while the surface morphs (no reflow), centred and clipped. */
function pinPanel(panel: HTMLElement, width: number): void {
  const s = panel.style;
  s.position = "absolute";
  s.top = "0";
  s.left = "50%";
  s.translate = "-50% 0";
  s.width = `${width}px`;
}

function unpinPanel(panel: HTMLElement): void {
  const s = panel.style;
  for (const p of ["position", "top", "left", "translate", "width"]) s.removeProperty(p);
}

function releaseOpen(l: Live): void {
  for (const release of l.release.splice(0)) release();
}

function focusPanel(surface: HTMLElement): void {
  const first = surface.querySelector<HTMLElement>("[data-morph-autofocus]") ?? tabbables(surface)[0] ?? surface;
  first.focus({ preventScroll: true });
}

function beginOpen(m: ItemMorph, l: Live): void {
  const surface = l.surface!;
  const item = l.item;
  const panel = panelOf(surface);
  const reopening = untrack(m.phase) === 2 && surface.hasAttribute("data-open");
  let rest: MorphRect | null = null;
  let row: MorphRect | null = null;
  if (!surface.hasAttribute("data-morphing")) {
    // From rest (primed / closed): measure the row, then the panel at its natural size.
    row = itemRect(item);
    unpinPanel(panel);
    rest = panelRect(surface, panel, row);
  }
  surface.setAttribute("data-open", "");
  surface.style.visibility = "";
  surface.style.overflow = "hidden";
  if (l.backdrop) {
    l.backdrop.setAttribute("data-open", "");
    l.backdrop.style.visibility = "";
  }
  if (rest) pinPanel(panel, rest.w);
  if (item) {
    item.setAttribute("data-morph-open", "");
    if (!surface.hasAttribute("aria-label") && item.id) surface.setAttribute("aria-labelledby", item.id);
  }
  if (!reopening || l.release.length === 0) {
    releaseOpen(l);
    const doc = surface.ownerDocument;
    const host = l.host ?? surface;
    l.release.push(ariaHideOutside([host], { shouldUseInert: true }));
    l.release.push(preventScroll());
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      closeItemMorph(m);
    };
    const onDown = (e: PointerEvent): void => {
      const t = e.target as Node | null;
      if (t && surface.contains(t)) return;
      e.preventDefault();
      closeItemMorph(m);
    };
    doc.addEventListener("keydown", onKey, true);
    doc.addEventListener("pointerdown", onDown, true);
    l.release.push(() => {
      doc.removeEventListener("keydown", onKey, true);
      doc.removeEventListener("pointerdown", onDown, true);
    });
  }
  const motion = { duration: m.duration, friction: m.friction };
  morphRectTo(surface, true, {
    ...motion,
    from: () => row ?? itemRect(item),
    to: () => rest ?? panelRect(surface, panel, row ?? itemRect(item)),
    backdrop: l.backdrop,
    onSettle: () => {
      unpinPanel(panel);
      surface.style.overflow = "auto";
      surface.style.maxHeight = `${innerHeight - 2 * MARGIN}px`;
    },
  });
  raf(() => {
    if (untrack(m.phase) === 2 && l.surface === surface && !surface.contains(surface.ownerDocument.activeElement)) focusPanel(surface);
  });
}

function beginClose(m: ItemMorph, l: Live, restoreFocus: boolean): void {
  const surface = l.surface;
  const item = l.item;
  m.phase.set(3);
  releaseOpen(l);
  item?.removeAttribute("data-morph-open");
  if (restoreFocus && item?.isConnected) item.focus({ preventScroll: true });
  if (!surface) {
    m.phase.set(0);
    return;
  }
  const panel = panelOf(surface);
  // Measure the resting open box before pinning the panel (pinned content leaves the flow: the surface would collapse).
  const rest = surface.hasAttribute("data-morphing") ? undefined : surfaceRect(surface);
  surface.removeAttribute("data-open");
  l.backdrop?.removeAttribute("data-open");
  if (rest) pinPanel(panel, panel.offsetWidth);
  surface.style.overflow = "hidden";
  morphRectTo(surface, false, {
    duration: m.duration,
    friction: m.friction,
    from: () => itemRect(item),
    to: () => rest ?? surfaceRect(surface),
    backdrop: l.backdrop,
    onSettle: () => {
      if (untrack(m.phase) !== 3) return;
      m.phase.set(0);
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------------------------

export interface ItemMorphPanelProps {
  /** The list's morph (`createItemMorph`). */
  morph: ItemMorph;
  /** Accessible name of the panel (default: named by the item). */
  "aria-label"?: string;
  /** Class of the morphing surface (`role="dialog"`). @default "rv-ItemMorph" */
  class?: string;
  /** Class of the panel content box inside the surface (set its width here). @default "rv-ItemMorph-panel" */
  panelClass?: string;
  /** Class of the backdrop. @default "rv-ItemMorph-backdrop" */
  backdropClass?: string;
  /** No backdrop element. */
  hideBackdrop?: boolean;
  /** The panel content for the item that opened it (render function: nothing renders or loads until a trigger). */
  children: (key: () => Key | null) => Content;
}

/**
 * The panel of an item morph: rendered on the overlay layer only while a hold primes it or it is open. Place it once
 * per list (anywhere: it portals). Surface `[data-morph-surface]` (`data-open`, `data-morphing`), content
 * `[data-morph-expanded]`, backdrop `[data-morph-backdrop]`; behaviour styles are inline.
 */
export function ItemMorphPanel(props: ItemMorphPanelProps): JSX.Element {
  const m = props.morph;
  const label = props["aria-label"];
  const surfaceClass = props.class ?? "rv-ItemMorph";
  const panelClass = props.panelClass ?? "rv-ItemMorph-panel";
  const backdropClass = props.backdropClass ?? "rv-ItemMorph-backdrop";
  const hideBackdrop = props.hideBackdrop === true;
  const children = props.children;
  const key = () => m.key();
  const anchor = createRef<HTMLElement>();
  // A controlled open key may change outside the item handlers: follow it (only then is there an effect).
  if (m.open.isControlled)
    clientEffect(() => {
      const value = m.open.value();
      if (anchor()) untrack(() => syncItemMorph(m, value));
    });
  return (
    // Own region site: only the Show re-creates when the phase changes (component-root Show rule).
    <span data-rv-item-morph-anchor="" style={{ display: "contents" }} ref={anchor}>
      <Show when={() => m.phase() > 0}>
        {() => {
          const host = createRef<HTMLElement>();
          const surface = createRef<HTMLElement>();
          const backdrop = createRef<HTMLElement>();
          clientEffect(() => {
            const el = surface();
            return () => itemMorphRemoved(m, el);
          });
          return (
            <Portal onPlaced={() => itemMorphPlaced(m, host(), surface(), backdrop())}>
              <div data-rv-item-morph-layer="" ref={host}>
                {hideBackdrop ? null : (
                  <div
                    ref={backdrop}
                    class={backdropClass}
                    data-morph-backdrop=""
                    aria-hidden="true"
                    style={{ position: "fixed", inset: "0", "z-index": "100", opacity: "0", visibility: "hidden" }}
                  />
                )}
                <div
                  ref={surface}
                  class={surfaceClass}
                  data-morph-surface=""
                  role="dialog"
                  aria-modal="true"
                  aria-label={label}
                  tabIndex={-1}
                  style={{ position: "fixed", left: "0", top: "0", "z-index": "100", visibility: "hidden", overflow: "hidden", "box-sizing": "border-box" }}
                >
                  <div class={panelClass} data-morph-expanded="">
                    {children(key)}
                  </div>
                </div>
              </div>
            </Portal>
          );
        }}
      </Show>
    </span>
  );
}
