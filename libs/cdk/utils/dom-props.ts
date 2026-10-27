// Ported from @react-types/shared `GlobalDOMEvents` / `GlobalDOMAttributes` (src/dom.d.ts) and
// react-aria `filterDOMProps(props, { global: true })` (packages/react-aria/src/utils/filterDOMProps.ts),
// Apache-2.0, © Adobe.
// Every component accepts the global DOM events and attributes and forwards them to its root
// element. Upstream's selection: mouse, touch, pointer, scroll, wheel, animation and transition
// events (+ Capture). Keyboard and focus events are props of focusable components; text input
// events (onInput, onBeforeInput, composition, clipboard) belong to the input element; drag and
// media events are left out (as upstream).
// Also every `data-*` attribute (RAC `filterDOMProps`) and `style` (RAC components resolve the `style`
// render prop and set it themselves: they list "style" in `owned`).
// A component that handles one of these events itself names it in `owned` and calls the user's
// handler from its own (react-aria chains them with `mergeProps`).
import type { EventMap } from "@rivetjs/runtime/jsx-runtime";
import { splitProps } from "@rivetjs/runtime/props";

type GlobalEventName =
  | "Click"
  | "AuxClick"
  | "ContextMenu"
  | "DblClick"
  | "MouseDown"
  | "MouseEnter"
  | "MouseLeave"
  | "MouseMove"
  | "MouseOut"
  | "MouseOver"
  | "MouseUp"
  | "TouchCancel"
  | "TouchEnd"
  | "TouchMove"
  | "TouchStart"
  | "PointerDown"
  | "PointerMove"
  | "PointerUp"
  | "PointerCancel"
  | "PointerEnter"
  | "PointerLeave"
  | "PointerOver"
  | "PointerOut"
  | "GotPointerCapture"
  | "LostPointerCapture"
  | "Scroll"
  | "Wheel"
  | "AnimationStart"
  | "AnimationEnd"
  | "AnimationIteration"
  | "TransitionCancel"
  | "TransitionEnd"
  | "TransitionRun"
  | "TransitionStart";

/** Global DOM event props (`onPointerEnter`, `onWheelCapture`, …), typed with the native event. */
export type GlobalDOMEvents<E extends Element = Element> = {
  [K in GlobalEventName as `on${K}` | `on${K}Capture`]?: (event: EventMap[K] & { currentTarget: E }) => void;
};

/** `data-*` attributes (RAC `filterDOMProps` forwards every one). */
export type DataAttributes = { [K in `data-${string}`]?: string | number | boolean | undefined };

/**
 * Global DOM attributes forwarded to the root element (+ every `data-*` attribute). `style` is forwarded
 * too but typed by the component (RAC `StyleProps` / `StyleRenderProps`), as upstream.
 */
export interface GlobalDOMAttributes<E extends Element = Element> extends GlobalDOMEvents<E>, DataAttributes {
  dir?: "ltr" | "rtl" | "auto";
  lang?: string;
  hidden?: boolean;
  inert?: boolean;
  translate?: "yes" | "no";
}

const GLOBAL =
  /^(?:on(?:Click|AuxClick|ContextMenu|DblClick|Mouse(?:Down|Enter|Leave|Move|Out|Over|Up)|Touch(?:Cancel|End|Move|Start)|Pointer(?:Down|Move|Up|Cancel|Enter|Leave|Over|Out)|GotPointerCapture|LostPointerCapture|Scroll|Wheel|Animation(?:Start|End|Iteration)|Transition(?:Cancel|End|Run|Start))(?:Capture)?|dir|lang|hidden|inert|translate|style|data-[^\s]+)$/;

/**
 * The global DOM events and attributes set on `props`, minus the `owned` names the component
 * handles itself. Spread the result on the root element: `<div {...globalDOMProps(props)} …>`.
 */
export function globalDOMProps(props: object, owned?: readonly string[]): Record<string, unknown> {
  return pick(props, GLOBAL, GLOBAL_KEYS, owned);
}

/** `aria-*` attributes and `role`: what a directive's host element keeps (Angular `cdkDrag` / `cdkDragHandle`). */
export type AriaDOMAttributes = { [K in `aria-${string}`]?: string | number | boolean | undefined } & { role?: string };

/**
 * Keyboard / focus listeners and `tabIndex` on an Angular CDK directive host (`Drag`, `DropList`, …): a template's
 * `(keydown)` / `(focus)` / `tabindex` on the host element stay there, so the Rivet components forward them too.
 */
export type HostDOMAttributes<E extends Element = Element> = AriaDOMAttributes & {
  onKeyDown?: (event: KeyboardEvent & { currentTarget: E }) => void;
  onKeyUp?: (event: KeyboardEvent & { currentTarget: E }) => void;
  onFocus?: (event: FocusEvent & { currentTarget: E }) => void;
  onBlur?: (event: FocusEvent & { currentTarget: E }) => void;
  onFocusIn?: (event: FocusEvent & { currentTarget: E }) => void;
  onFocusOut?: (event: FocusEvent & { currentTarget: E }) => void;
  tabIndex?: number;
};

// Built on first use: a module-level `new RegExp(…)` call is never tree-shaken (it stayed in every bundle importing
// this module); here it goes with `hostDOMProps` when an app has no drag-drop.
let HOST: RegExp | undefined;

/**
 * `globalDOMProps` + every `aria-*` attribute, `role`, keyboard / focus listeners and `tabIndex`: for components ported
 * from Angular CDK directives (`Drag`, `DragHandle`, `DropList`, `DropListGroup`), where attributes and listeners the app
 * writes stay on the host element. RAC's `filterDOMProps` `labelable` set (`aria-label` / `-labelledby` /
 * `-describedby` / `-details`) is a subset.
 */
export function hostDOMProps(props: object, owned?: readonly string[]): Record<string, unknown> {
  HOST ??= new RegExp(`${GLOBAL.source.slice(0, -2)}|role|aria-[a-z]+|onKey(?:Down|Up)|onFocus(?:In|Out)?|onBlur|tabIndex)$`);
  return pick(props, HOST, HOST_KEYS, owned);
}

// Parse once per key string (docs/guides/performance.md): the alternation regex per prop key of every part root was
// ~40% of `pick`; key → match, bounded so arbitrary user keys cannot grow it.
const GLOBAL_KEYS = new Map<string, boolean>(),
  HOST_KEYS = new Map<string, boolean>(),
  TEXT_INPUT_KEYS = new Map<string, boolean>();
function matches(cache: Map<string, boolean>, pattern: RegExp, key: string): boolean {
  let hit = cache.get(key);
  if (hit === undefined) {
    hit = pattern.test(key);
    if (cache.size < 512) cache.set(key, hit);
  }
  return hit;
}

// Live props (P5): a live key (own getter) is forwarded unread — the result is a `splitProps` part over the matching
// keys, read by the element spread's binding; without getters the matching defined values are copied (as before).
function pick(props: object, pattern: RegExp, cache: Map<string, boolean>, owned: readonly string[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let keys: string[] | undefined;
  for (const key in props) {
    if (!matches(cache, pattern, key) || owned?.includes(key)) continue;
    (keys ??= []).push(key);
    const desc = Object.getOwnPropertyDescriptor(props, key);
    if (desc?.get !== undefined) return forward(props as Record<string, unknown>, keys.concat(rest(props, key, pattern, cache, owned)));
    const value = desc ? desc.value : (props as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

const PROXY = Symbol.for("rivet.props");

/**
 * A writable bag forwarding `keys` to `props` (components add attributes to it). A proxied props object (a spread of
 * a call / conditional: runtime Proxy, whose parts discard writes) gets plain forwarding getters over the keys it
 * has now.
 */
function forward(props: Record<PropertyKey, unknown>, keys: string[]): Record<string, unknown> {
  if (props[PROXY] !== 1) return splitProps(props, keys as never)[0] as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) Object.defineProperty(out, key, { enumerable: true, configurable: true, get: () => props[key] });
  return out;
}

/** The matching keys of `props` after `from` (live path: the whole key list for `splitProps`). */
function rest(props: object, from: string, pattern: RegExp, cache: Map<string, boolean>, owned: readonly string[] | undefined): string[] {
  const keys: string[] = [];
  let after = false;
  for (const key in props) {
    if (key === from) after = true;
    else if (after && matches(cache, pattern, key) && !owned?.includes(key)) keys.push(key);
  }
  return keys;
}

type TextInputEventName = "Input" | "BeforeInput" | "CompositionStart" | "CompositionUpdate" | "CompositionEnd" | "Copy" | "Cut" | "Paste" | "Select";

/**
 * Text input DOM events (RA `TextInputDOMProps`, RAC `Input`): forwarded to the `<input>` /
 * `<textarea>` of TextField, TextArea, ComboBox… (+ Capture).
 */
export type TextInputDOMEvents<E extends Element = HTMLInputElement> = {
  [K in TextInputEventName as `on${K}` | `on${K}Capture`]?: (event: EventMap[K] & { currentTarget: E }) => void;
};

const TEXT_INPUT = /^on(?:Input|BeforeInput|Composition(?:Start|Update|End)|Copy|Cut|Paste|Select)(?:Capture)?$/;

/**
 * The text input DOM events set on `props`, minus `owned` (default `onInput`: inputs handle it
 * themselves and call the user's from their own). Spread the result on the input element.
 */
export function textInputDOMProps(props: object, owned: readonly string[] = ["onInput"]): Record<string, unknown> {
  return pick(props, TEXT_INPUT, TEXT_INPUT_KEYS, owned);
}
