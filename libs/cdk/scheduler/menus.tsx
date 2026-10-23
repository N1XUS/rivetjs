// Ported from @malva-ui/scheduler (src/lib/scheduler/scheduler.ts `_hasContextMenu` / `_contextMenu` /
// `_menuHoldsSelection` / `_openContextMenu` / `_onContextMenuClosed` / `_slotRange`, scheduler.html context menu,
// scheduler-defs.ts `MlvSchedulerSlotMenuDef` / `MlvSchedulerEventMenuDef`) and @malva-ui/core/menu
// (context-menu-trigger.ts `openFromEvent` / `_isKeyboardInitiated`), MIT, © 2026 Malva UI.
// Rivet:
// - the two menu defs → `renderSlotMenu(range, { selection, view, close })` / `renderEventMenu(event, { view, close })`
//   (read once at mount; their output is reactive): the items are cdk `MenuItem`s (and sections / separators) inside
//   one cdk `Menu` in one standalone, non-modal cdk `Popover` per scheduler (R4: cdk has no context-menu trigger).
// - the open menu is one root signal (`SchedulerMenuOpen`, written only in the browser: element + event values):
//   a pointer open positions at the pointer (`getTargetRect`), a keyboard one (ContextMenu key / `Shift+F10`, or a
//   `contextmenu` an assistive technology synthesised) against the cell / chip and focuses the first item; a second
//   right-click re-targets the open panel (the content re-renders, the position follows the anchor); the overlay's
//   focus scope returns focus to the element focused before the open.
// - the pending keyboard selection a slot menu took is cleared when the menu closes (malva bumps `selectionRelease`
//   for the views to clear their own selection; here the selection is the one root signal).
// - non-modal: no underlay, nothing outside goes inert, so a right-click elsewhere reaches the scheduler and re-targets
//   (malva: overlay without a backdrop); Escape, an item action and focus leaving the panel close it.
import { schedulerPart, type SchedulerClassNames } from "./context.tsx";
import { untrack, type Signal } from "@rivetjs/reactivity";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { Menu } from "../menu/index.tsx";
import { Popover } from "../popover/index.tsx";
import type { SchedulerEvent, SchedulerRange, SchedulerView } from "./layout.ts";
import type { SchedulerAxis } from "./context.tsx";
import type { SchedulerLayoutRange } from "./layout.ts";

/** Second argument of `renderSlotMenu` (malva `MlvSchedulerSlotMenuContext` minus `$implicit`). */
export interface SchedulerSlotMenuContext {
  /** The range is the pending keyboard selection the cell lies in (not the cell's own day / slot). */
  readonly selection: boolean;
  /** The view the menu opened in. */
  readonly view: SchedulerView;
  /** Closes the menu. */
  readonly close: () => void;
}

/** Second argument of `renderEventMenu` (malva `MlvSchedulerEventMenuContext` minus `$implicit`). */
export interface SchedulerEventMenuContext {
  readonly view: SchedulerView;
  readonly close: () => void;
}

/** `renderSlotMenu` (read once at mount): items of the menu over an empty month cell, all-day cell or time slot. */
export type SchedulerRenderSlotMenu = (range: SchedulerRange, context: SchedulerSlotMenuContext) => Content;
/** `renderEventMenu` (read once at mount): items of the menu over an event chip. */
export type SchedulerRenderEventMenu<T = unknown> = (event: SchedulerEvent<T>, context: SchedulerEventMenuContext) => Content;

/** The open context menu (browser only). */
export interface SchedulerMenuOpen<T = unknown> {
  readonly kind: "slot" | "event";
  readonly event: SchedulerEvent<T> | null;
  readonly range: SchedulerRange | null;
  readonly selection: boolean;
  /** Sticky across re-targets: some open of this panel took the pending selection (released on close). */
  readonly holds: boolean;
  /** Panel `aria-label` (`eventMenu` / `slotMenu`). */
  readonly label: string;
  readonly view: SchedulerView;
  /** The cell / chip: keyboard anchor, direction scope. */
  readonly anchor: HTMLElement;
  /** Client point of a pointer open, `null` for a keyboard one. */
  readonly point: { readonly x: number; readonly y: number } | null;
  /** Bumped per open (a re-target re-renders the items and re-positions). */
  readonly sequence: number;
}

/** What the root passes when an interaction opens a menu. */
export type SchedulerMenuRequest<T> = Omit<SchedulerMenuOpen<T>, "holds" | "point" | "sequence">;

/**
 * A keyboard-initiated `contextmenu` (malva `_isKeyboardInitiated`): Firefox names its source, other browsers send a
 * synthesised event with `detail` 0 at the client origin.
 */
function keyboardInitiated(event: MouseEvent): boolean {
  const source = (event as MouseEvent & { mozInputSource?: number }).mozInputSource;
  if (source !== undefined) return source === 6;
  return event.detail === 0 && event.clientX === 0 && event.clientY === 0;
}

/**
 * Opens (or re-targets) the menu from `native` (malva `openFromEvent`): a `contextmenu` mouse event is prevented (the
 * consumer's `onEventContextMenu` / `onSlotContextMenu` then sees `defaultPrevented`), the key was claimed already.
 */
export function openSchedulerMenu<T>(menu: Signal<SchedulerMenuOpen<T> | null>, request: SchedulerMenuRequest<T>, native: MouseEvent | KeyboardEvent): void {
  const pointer = native instanceof MouseEvent && native.type === "contextmenu" && !keyboardInitiated(native);
  if (native instanceof MouseEvent) native.preventDefault();
  const previous = untrack(menu);
  menu.set({
    ...request,
    point: pointer ? { x: (native as MouseEvent).clientX, y: (native as MouseEvent).clientY } : null,
    holds: !!previous?.holds || request.selection,
    sequence: (previous?.sequence ?? 0) + 1,
  });
}

/**
 * The range a slot menu is about without a selection (malva `_slotRange`): a month / all-day cell = its day; a slot =
 * its own duration, clamped to `maxTime` (24:00 = the next midnight: wall minutes roll over by themselves).
 */
export function slotMenuRange(day: number, minutes: number | null, axis: SchedulerAxis): SchedulerLayoutRange {
  if (minutes === null) return { start: day * 1440, end: (day + 1) * 1440, allDay: true };
  return { start: day * 1440 + minutes, end: day * 1440 + Math.min(minutes + axis.slot, axis.max), allDay: false };
}

/**
 * The scheduler's one context-menu panel (rendered only when `renderSlotMenu` or `renderEventMenu` is given):
 * `Popover.rv-SchedulerMenu-popover` (standalone, non-modal) > `Menu.rv-SchedulerMenu[aria-label]` > the items.
 */
export function SchedulerMenu<T>(props: {
  menu: Signal<SchedulerMenuOpen<T> | null>;
  classNames?: () => SchedulerClassNames | undefined;
  close: () => void;
  renderSlotMenu: SchedulerRenderSlotMenu | undefined;
  renderEventMenu: SchedulerRenderEventMenu<T> | undefined;
}) {
  const menu = props.menu;
  const close = props.close;
  const renderSlotMenu = props.renderSlotMenu;
  const renderEventMenu = props.renderEventMenu;
  return (
    <Popover
      triggerRef={() => {
        // Tracks the open: a re-target re-positions against the new anchor / point.
        const open = menu();
        return open ? open.anchor : null;
      }}
      getTargetRect={() => {
        const point = untrack(menu)?.point;
        return point ? new DOMRect(point.x, point.y, 0, 0) : null;
      }}
      isOpen={() => menu() !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      isNonModal
      placement="bottom start"
      offset={4}
      class={schedulerPart("rv-SchedulerMenu-popover", props.classNames?.(), "menuPopover")}
    >
      {() => {
        const open = menu();
        // Re-rendered per open: a re-target renders the new items and focuses again.
        if (!open) return null;
        return (
          <Menu
            class={schedulerPart("rv-SchedulerMenu", props.classNames?.(), "menu")}
            aria-label={open.label}
            autoFocus={open.point ? true : "first"}
            onClose={() => close()}
          >
            {open.kind === "event"
              ? renderEventMenu!(open.event!, { view: open.view, close: () => close() })
              : renderSlotMenu!(open.range!, { selection: open.selection, view: open.view, close: () => close() })}
          </Menu>
        );
      }}
    </Popover>
  );
}
