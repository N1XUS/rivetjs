// Ported from react-aria `useToolbar` (packages/react-aria/src/toolbar/useToolbar.ts), Apache-2.0, © Adobe.
// Arrow keys move focus between the toolbar's focusable controls (across groups and separators), Tab leaves the
// toolbar, focus returns to the last focused control.
// Rivet (naming convention): `useToolbar(props, ref)` → `toolbarProps(props, isInToolbar?)` (the attribute bag) +
// handlers `toolbarKeyDown(event, props)`, `toolbarFocus(event)`, `toolbarBlur(event)` wired as inline arrows on
// `onKeyDown` / `onFocusIn` / `onFocusOut`; the last focused control lives in a module WeakMap (transient).
// Deviations: bubbling keydown / focusin / focusout instead of capture listeners (capture handlers are not
// resumable yet), so a descendant that stops propagation of an arrow key keeps it; `isInToolbar` (RA: a layout
// effect reading the DOM) is known at render from the enclosing `<Toolbar>` (correct server markup) and checked
// again at event time.
import { direction } from "@rivetjs/cdk/bidi";
import { createFocusManager } from "@rivetjs/cdk/focus";
import type { AriaLabelingProps, Direction, Orientation } from "../utils/types.ts";

/** RA `AriaToolbarProps`. */
export interface AriaToolbarProps extends AriaLabelingProps {
  /**
   * The orientation of the entire toolbar.
   * @default 'horizontal'
   */
  orientation?: Orientation;
  id?: string;
}

/** Last control focused before focus left each toolbar (transient, browser only). */
const lastFocused = new WeakMap<Element, HTMLElement>();

const isNested = (toolbar: Element): boolean => !!toolbar.parentElement?.closest('[role="toolbar"]');

/** RA `useToolbar` `toolbarProps` attributes (`role="group"` inside another toolbar). */
export function toolbarProps(props: AriaToolbarProps, isInToolbar = false): Record<string, unknown> {
  const orientation = props.orientation ?? "horizontal";
  const ariaLabel = props["aria-label"];
  return {
    id: props.id,
    "aria-describedby": props["aria-describedby"],
    "aria-details": props["aria-details"],
    role: !isInToolbar ? "toolbar" : "group",
    "aria-orientation": orientation,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabel == null ? props["aria-labelledby"] : undefined,
  };
}

/** Keys held by the loader while the chunk loads (`data-rk`). */
export const toolbarKeys = (orientation: Orientation = "horizontal"): string => (orientation === "vertical" ? "ArrowUp ArrowDown" : "ArrowLeft ArrowRight");

/** keydown on the toolbar (`props.orientation`, `props.direction` = the locale's, from `useLocale()`). */
export function toolbarKeyDown(e: KeyboardEvent, props: Pick<AriaToolbarProps, "orientation"> & { direction?: Direction }): void {
  const toolbar = e.currentTarget as HTMLElement;
  if (isNested(toolbar) || !toolbar.contains(e.target as Node)) return;
  const orientation = props.orientation ?? "horizontal";
  // RA: the locale's direction (`useLocale()`, passed as `props.direction`); Rivet also honours a DOM `dir="rtl"`.
  const shouldReverse = (props.direction === "rtl" || direction(toolbar) === "rtl") && orientation === "horizontal";
  const fm = createFocusManager(() => toolbar);
  if ((orientation === "horizontal" && e.key === "ArrowRight") || (orientation === "vertical" && e.key === "ArrowDown")) {
    if (shouldReverse) fm.focusPrevious();
    else fm.focusNext();
  } else if ((orientation === "horizontal" && e.key === "ArrowLeft") || (orientation === "vertical" && e.key === "ArrowUp")) {
    if (shouldReverse) fm.focusNext();
    else fm.focusPrevious();
  } else if (e.key === "Tab") {
    // Move to the first / last control and let the browser's Tab leave the toolbar from there.
    const active = toolbar.ownerDocument.activeElement as HTMLElement | null;
    if (active) lastFocused.set(toolbar, active);
    if (e.shiftKey) fm.focusFirst();
    else fm.focusLast();
    return;
  } else return;
  // Arrow keys are not handled by nested action groups.
  e.stopPropagation();
  e.preventDefault();
}

/** focusout: remember the control focus left from. */
export function toolbarBlur(e: FocusEvent): void {
  const toolbar = e.currentTarget as HTMLElement;
  if (isNested(toolbar)) return;
  if (!toolbar.contains(e.relatedTarget as Node) && !lastFocused.has(toolbar)) lastFocused.set(toolbar, e.target as HTMLElement);
}

/** focusin: focus entering the toolbar returns to the last focused control. */
export function toolbarFocus(e: FocusEvent): void {
  const toolbar = e.currentTarget as HTMLElement;
  if (isNested(toolbar)) return;
  const last = lastFocused.get(toolbar);
  if (last && !toolbar.contains(e.relatedTarget as Node) && toolbar.contains(e.target as Node)) {
    lastFocused.delete(toolbar);
    if (last.isConnected && last !== e.target) last.focus();
  }
}
