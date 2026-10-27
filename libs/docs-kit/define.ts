// Example manifest helper. Each `examples/<id>/example.ts` default-exports `defineExample({...})`.

/** One scripted browser step, run by the example build (Playwright) against the production build. */
export type Step =
  | { click: string }
  /** Double-click the element (fires `dblclick`, after two `click`s). */
  | { dblclick: string }
  /** Right-click the element (fires `contextmenu`). */
  | { rightclick: string }
  /**
   * Right-click the element and fail unless the page canceled the browser's own context menu (the trusted `contextmenu`
   * event's default prevented, by a live handler or the resume loader holding a cold one): a custom context menu.
   */
  | { contextmenu: string }
  /** Press and hold the primary mouse button on the element's centre for `ms` (default 700), then release (long press / press-and-hold, e.g. an item morph). */
  | { longpress: string | [selector: string, ms: number] }
  /** Move the mouse over the element (fires `pointerover`/`pointerenter`/`mouseover`; hover intent, tooltips, hover cards). */
  | { hover: string }
  /** Move the mouse over the element, then turn the wheel by `deltaY` pixels (positive scrolls down; fires `wheel`). */
  | { wheel: [selector: string, deltaY: number] }
  /** Press the mouse on the first element, move to the second, release (pointer drags and HTML drag and drop). */
  | { drag: [from: string, to: string] }
  /** Touch the element's centre and lift (fires `touchstart`/`touchend`, `pointerdown`/`pointerup` with `pointerType: "touch"`, then `click`). */
  | { tap: string }
  | { fill: [selector: string, value: string] }
  /** Focus the element, then press the key (Playwright key names: "ArrowDown", "Shift+Tab", "Escape"). */
  | { press: [selector: string, key: string] }
  /** Press a key on whatever has focus now (Tab order, focus traps, keys after a focus move). */
  | { key: string }
  /** Wait until the element's text contains the value. */
  | { expect: [selector: string, text: string] }
  /** Wait until the element's attribute equals the value (`null`: the attribute is absent). */
  | { attr: [selector: string, name: string, value: string | null] }
  /** Wait until the element's accessible name (aria-labelledby, aria-label, its `<label>`, else its text) contains the text. */
  | { name: [selector: string, text: string] }
  /** Wait until the text of the elements its `aria-describedby` points at contains the text. */
  | { described: [selector: string, text: string] }
  /** Wait until the focused element (`document.activeElement`) matches the selector. */
  | { focused: string }
  /** Wait until some element matches the selector (state pseudo-classes: `:popover-open`, `:modal`, `:checked`, `[open]`). */
  | { matches: string }
  /** Wait until no element matches the selector. */
  | { absent: string };

export interface ExampleConfig {
  title: string;
  /** One sentence: what the example shows. */
  summary: string;
  tags?: string[];
  status?: "stable" | "experimental" | "planned";
  /**
   * `static` (default): a live page of the docs app (`/examples/<id>/frame/`), shown in an iframe next to its code.
   * `server`: needs a server (actions, guards, cookies); shown as code only.
   */
  mode?: "static" | "server";
  /**
   * Preview frame. `height`: the frame's height in px or a size (`xs` 96, `sm` 180 (default), `md` 320, `lg` 480,
   * `xl` 640), reserved before the page loads (no layout shift). `auto` (default false): the frame then follows its
   * page's content height (posted by the frame page, clamped to 48–1600 px; overlays such as popovers and modals are
   * not counted), starting from `height` — for examples whose content grows or shrinks (accordions, disclosures,
   * lists, forms showing errors); set `height` near the initial content height. Optional phone width. `theme`
   * (default true): the frame follows the docs site's light / dark theme (`dark` / `light` class + `data-theme` on the
   * example's `<html>`); `false` for an example that manages its own theme (a theme toggle).
   */
  frame?: { height?: "xs" | "sm" | "md" | "lg" | "xl" | number; auto?: boolean; width?: "full" | "phone"; theme?: boolean };
  /** Files shown as code tabs, in order (paths inside the example). */
  show: string[];
  /** Steps the build runs in Chromium; the first input step (click, fill, press, key, dblclick, rightclick, contextmenu, longpress, hover, wheel, drag, tap) counts as the first interaction. */
  test?: Step[];
}

/** Declare an example (typed identity). */
export function defineExample(config: ExampleConfig): ExampleConfig {
  return config;
}
