// DOM v2 `{...spread}` (compiler ABI `_spread`, re-exported by `dom-v2.ts` / `dom.ts`). Its own module so
// bundlers place it (and the style runtime it pulls in, `_applyStyle`) only with the chunks whose
// templates spread: an eager chunk that uses other v2 helpers does not carry it.
import { _bindingEffect, _dispatch, getOwner, onCleanup, runWithOwner, signal } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { _attrWrite, _cls, _insert, _on } from "./dom-v2.ts";
import { bindRef } from "./dom.ts";
import { _applyStyle } from "./style.ts";

const HTML = "http://www.w3.org/1999/xhtml";
// Bubbling events delegated through `_on` (the compiler's list, `compile/dom_v2.rs`).
const DELEGATED =
  /^(beforeinput|click|contextmenu|dblclick|focusin|focusout|input|keydown|keyup|mouse(down|move|out|over|up)|pointer(down|move|out|over|up)|touch(end|move|start))$/;
// Attribute name rule: no `on*`, no compiler markers, no raw-HTML / style sinks.
const SAFE_NAME = /^(?!on)(?!data-rivet-s\d)[A-Za-z_][\w:.-]*$/i,
  UNSAFE_NAME = /^(innerhtml|dangerouslysetinnerhtml|srcdoc|style)$/;
type Handler = ((event: Event) => unknown) | null | undefined;
// `on[A-Z]…`: a listener key (charCode test: the hot per-key check, no regex).
const isOn = (name: string): boolean => {
  const c = name.charCodeAt(2);
  return c >= 65 && c <= 90 && name.charCodeAt(0) === 111 && name.charCodeAt(1) === 110;
};
// Attribute names already validated (module-wide: cdk parts spread the same ~30 names on every element). Bounded so
// arbitrary dynamic keys cannot grow it without limit; past the cap names are checked per spread (`SpreadState.names`).
const CHECKED: Record<string, true> = Object.create(null);
let checkedCount = 0;
const NONE: ReadonlySet<string> = new Set();
// A server-rendered attribute name (resume baseline): every present key applies on the first run.
const RENDERED = {};
// Resumed `flags & 1` spread before its first run: the content is the server's.
const SERVER = {},
  SLOT = Symbol.for("rivet.slot");
/** Resume hook (pay-per-use: installed by a resumed `_spread`, so pages without resumed spreads ship none of it):
 * event types an activated spread took over per element (its own handler replaces the element's resumed entry),
 * and the deferral of an ancestor's resumed bubbling handler behind such a descendant (the loader's capture-phase
 * walk would run it first). */
export let _takeover: Takeover | undefined;
interface Takeover {
  add(el: Element, type: string): void;
  /** Run `call` after the handler of the outermost element between the event's target and `ancestor` (exclusive)
   * that took `type` over (unless it stopped propagation); false when there is none. */
  defer(event: Event, ancestor: Element, type: string, call: () => void): boolean;
}
let taken: WeakMap<Element, Set<string>> | undefined;
const TAKEOVER: Takeover = {
  add(el, type) {
    let types = (taken ??= new WeakMap()).get(el);
    if (!types) taken.set(el, (types = new Set()));
    types.add(type);
  },
  defer(event, ancestor, type, call) {
    let taker: Element | undefined, below: Element | undefined;
    if (taken)
      for (const node of event.composedPath() as Element[]) {
        if (node === ancestor) {
          taker = below;
          break;
        }
        if (taken.get(node)?.has(type)) below = node;
      }
    if (!taker) return false;
    // A delegated handler runs in the document's bubble listener (registered before this one); a direct one on the element.
    const at: EventTarget = DELEGATED.test(type) ? taker.ownerDocument : taker;
    const later = (e: Event) => {
      if (e !== event) return;
      at.removeEventListener(type, later);
      if (!event.cancelBubble) call();
    };
    at.addEventListener(type, later);
    setTimeout(() => at.removeEventListener(type, later));
    return true;
  },
};
interface SpreadState {
  /** Last applied value per normalized name (attribute value, handler, or class). */
  prev: Record<string, unknown>;
  /** Explicit `_on` handler present before the spread first wrote a delegated type (created on first use). */
  own: Record<string, Handler> | undefined;
  /** Direct listeners attached (per `type` / `type!` capture key; created on first use). */
  direct: Record<string, true> | undefined;
  /** Current handler per direct key, read at dispatch (created on first use). */
  handlers: Record<string, Handler> | undefined;
  /** Names validated by this spread once the module-wide cache is full (created on first use). */
  names: Record<string, true> | undefined;
  /** Properties set by the last `style` object (diffed like `_bindStyle`). */
  style: ReadonlySet<string>;
}
/**
 * Compiler ABI: `{...x}` on a v2 element. `value` is the merged object (spreads and plain attributes in
 * source order, later keys win) or a thunk when any part can read reactive state; keys are diffed per
 * run. `on[A-Z]*` keys are listeners (delegated bubbling types compose after an explicit `_on` handler;
 * others and `*Capture` are direct listeners), `class` / `className` write the class, `htmlFor` is
 * `for`, other names go through the full attribute writer (name validation). `children` is not an
 * attribute and `ref` is bound once (first run, like `ref={…}`); with `flags & 1` (no JSX children) `children` is the element's content. Accessor values
 * are read inside the one spread effect (whole-object re-diff on change). `flags & 2`: `value` is the spread argument itself (no copy), read inside
 * the effect so live getters stay live. `rendered` (resume: a spread binding
 * over server markup, `"..." + names`): the attribute names the server rendered from the spread, removed unless
 * present (a ` =class` token carries the rendered string class: an equal first-run class is not rewritten); HTML names compare lowercased (`tabIndex` is the server's `tabindex`: never removed then re-added),
 * and the first run keeps live form state (`value` / `checked` / `selected` the user changed before the binding
 * activated) while the new value still is the server's (`default*` property).
 */
// Still the server-rendered state: `next` equals the control's `default*` property (what the server wrote).
const keepLive = (el: Element, name: string, v: unknown): boolean =>
  (name === "value" ? (v == null ? "" : String(v)) : Boolean(v)) ===
  (el as unknown as Record<string, unknown>)["default" + name[0]!.toUpperCase() + name.slice(1)];
// Listener keys (`onKeyDownCapture` → type, capture, delegated, store key) parsed once per name, module-wide and
// bounded like `CHECKED`: a regex exec + lowercase + delegation test per key per element was the top self-time
// line of cdk form-control mounts (HOTPATH 2026-10-09). `key` = the `_on` expando (`$$type`, delegated) or the
// direct-listener key (`type` / `type!`).
interface ListenerKey {
  type: string;
  capture: boolean;
  delegated: boolean;
  key: string;
}
const LISTENERS: Record<string, ListenerKey> = Object.create(null);
let listenerCount = 0;
function listenerOf(name: string): ListenerKey {
  let listener = LISTENERS[name];
  if (listener === undefined) {
    const [, raw, capture] = /^on(.+?)((?<!Pointer)Capture)?$/.exec(name)!;
    const type = raw!.toLowerCase(),
      delegated = !capture && DELEGATED.test(type);
    listener = { type, capture: !!capture, delegated, key: delegated ? "$$" + type : capture ? type + "!" : type };
    if (listenerCount < 512) ((LISTENERS[name] = listener), listenerCount++);
  }
  return listener;
}
// `exclude` strings (compiler literals, one per element shape) → their name sets, parsed once per distinct string.
let excluded: Map<string, ReadonlySet<string>> | undefined;
export function _spread(
  el: Element,
  value: object | (() => object | null | undefined) | null | undefined,
  flags = 0,
  rendered?: string | null,
  exclude?: string,
): void {
  let skip: ReadonlySet<string> | undefined;
  if (exclude) {
    skip = (excluded ??= new Map()).get(exclude);
    if (!skip) excluded.set(exclude, (skip = new Set(exclude.split(" "))));
  }
  const owner = getOwner(),
    // `own` / `direct` / `handlers` / `names` are created on first use (most spreads bind no direct listener and never
    // pass the validated-name cap): 4 objects less per spread element.
    state: SpreadState = { prev: {}, own: undefined, direct: undefined, handlers: undefined, names: undefined, style: NONE };
  let resumed = rendered != null,
    // Resumed: the server content stays until `children` changes, unless the server's spread object read
    // signals itself (`#c`, `_rSpread`): then its `children` may already differ from what the server rendered.
    keep = resumed,
    // Resumed, function `children` rendered as its own site (`#r`): never written here (it binds / re-creates itself).
    site = false;
  if (resumed) {
    _takeover = TAKEOVER;
    for (const name of rendered!.slice(3).split(" "))
      if (name === "#c") keep = false;
      else if (name === "#r") site = true;
      // ` =class`: the string class the server rendered (spaces as newlines): an equal first-run class is not rewritten, so
      // classes client code added since (DOM plugins: embla ClassNames `is-snapped`) stay.
      else if (name[0] === "=") state.prev.class = name.slice(1).replace(/\n/g, " ");
      else if (name) state.prev[name] = RENDERED;
  }
  const html = el.namespaceURI === HTML,
    lower = resumed && html;
  // `flags & 1`: the content slot, written only when the `children` value changes (identity): an
  // attribute-only re-run keeps the child nodes (focus, input values, nested state). `held` = the
  // children the content currently shows while no slot exists yet (`SERVER`: the resumed server content).
  let kids: Signal<unknown> | null = null,
    held: unknown = SERVER;
  if (flags & 1 && !keep) {
    el.textContent = "";
    kids = signal<unknown>(undefined);
  }
  const check = (name: string): void => {
    if (CHECKED[name] || state.names?.[name]) return;
    if (!SAFE_NAME.test(name) || UNSAFE_NAME.test(name.toLowerCase())) throw TypeError("Unsafe attribute name");
    if (checkedCount < 512) ((CHECKED[name] = true), checkedCount++);
    else (state.names ??= {})[name] = true;
  };
  const apply = (name: string, v: unknown): void => {
    if (isOn(name)) {
      const listener = listenerOf(name),
        type = listener.type,
        capture = listener.capture;
      if (v != null && typeof v !== "function") throw TypeError("Event handler must be a function, null or undefined");
      const handler = v as Handler;
      if (listener.delegated) {
        const owns = (state.own ??= {});
        if (!(type in owns)) owns[type] = (el as unknown as Record<string, Handler>)[listener.key];
        const own = owns[type];
        _on(el, type, handler ? (own ? (event) => (own(event), handler(event)) : handler) : own);
        return;
      }
      const key = listener.key;
      const handlers = (state.handlers ??= {}),
        direct = (state.direct ??= {});
      handlers[key] = handler;
      // Bound on the first defined handler (read at dispatch): an unset handler key binds nothing (like `_listen`).
      if (handler && !direct[key]) {
        direct[key] = true;
        const options = capture ? { capture: true } : undefined,
          listener = (event: Event) => {
            const current = handlers[key];
            if (current) _dispatch(owner, current, el, event);
          };
        el.addEventListener(type, listener, options);
        runWithOwner(owner, () => onCleanup(() => el.removeEventListener(type, listener, options)));
      }
      return;
    }
    // SVG / MathML `className` is read-only (SVGAnimatedString): there `class` is a plain attribute.
    if (name === "class" && el.namespaceURI === HTML) return _cls(el, v);
    if (name === "style") return void (state.style = _applyStyle(el, v, state.style));
    check(name);
    _attrWrite(el, name, v);
  };
  let first = true;
  const run = (next: Record<string, unknown>): void => {
    const present: Record<string, unknown> = {};
    let live: string | null = null;
    for (const key in next) {
      if (key === "children") continue;
      // An explicit attribute after the last spread (compiler `exclude`, normalized names; HTML lowercased) owns the key:
      // the spread never writes it, even with the explicit value unset.
      if (skip !== undefined && (skip.has(key) || (html && skip.has(key === "className" ? "class" : key === "htmlFor" ? "for" : key.toLowerCase())))) continue;
      // `ref`: bound once, on the first run (like an explicit `ref={…}`), never an attribute.
      if (key === "ref") {
        if (first) ((first = false), runWithOwner(owner, () => bindRef(el, next[key] as never)));
        continue;
      }
      let v = next[key];
      let name = key === "className" ? "class" : key === "htmlFor" ? "for" : key;
      if (lower && !isOn(name)) name = name.toLowerCase();
      if (typeof v === "function" && !isOn(name)) {
        v = (v as () => unknown)();
        if (name === "checked" || name === "value") live = live === null ? name : live + " " + name;
      }
      present[name] = v;
    }
    if (resumed && lower)
      // The server rendered `defaultValue` / `defaultChecked` as `value` / `checked`: not a removed key.
      for (const key of ["value", "checked"]) if ("default" + key in present && !(key in present)) delete state.prev[key];
    for (const name in state.prev) if (!(name in present)) apply(name, undefined);
    for (const name in present) {
      const v = present[name];
      // Resumed, first run: live form state the server value still matches stays (what the user typed or toggled).
      if (resumed && (name === "value" || name === "checked" || name === "selected") && name in el && keepLive(el, name, v)) continue;
      if (!(name in state.prev)) {
        // A new null / undefined attribute key the element does not carry (a fresh clone: cdk parts spread 15–20
        // unset aria / data keys) writes nothing: removing an absent attribute is a no-op. The name is still validated
        // (unsafe names throw whatever the value); a later value applies (`present` records the key).
        if (v != null || isOn(name) || el.hasAttribute(name)) apply(name, v);
        else if (name !== "class" && name !== "style") check(name);
      } else if (!Object.is(state.prev[name], v)) apply(name, v);
      // An accessor-bound `checked` / `value` (a controlled control) is re-asserted on every run although its
      // value is unchanged, as a per-key binding re-running on its own reads would: a canceled checkbox click
      // restores the pre-click `checked`, typed text drifts from a controlled value. Property only.
      else if (live !== null && v != null && (name === "checked" || name === "value") && live.includes(name) && name in el) {
        const want = name === "checked" ? Boolean(v) : String(v);
        if ((el as unknown as Record<string, unknown>)[name] !== want) (el as unknown as Record<string, unknown>)[name] = want;
      }
    }
    state.prev = present;
    resumed = false;
    if (kids) kids.set(next.children);
    else if (flags & 1 && !site) {
      const children = next.children;
      // Slot children (compiled JSX children, branded) rendered with their own resumable bindings; a plain
      // accessor or an array (which may hold one) did not: it re-renders.
      if (held === SERVER && !(Array.isArray(children) || (typeof children === "function" && !(SLOT in children)))) held = children;
      else if (!Object.is(held, children)) {
        // The resumed content's first change: replace the server nodes with a slot under the spread's owner
        // (not this run's effect, which would dispose it on its next run).
        el.textContent = "";
        kids = signal<unknown>(children);
        runWithOwner(owner, () => _insert(el, kids, null));
      }
    }
  };
  if (typeof value === "function") _bindingEffect(() => run(((value as () => object | null | undefined)() ?? {}) as Record<string, unknown>));
  // `flags & 2`: an uncopied object (compiler: `<el {...rest}>`, a lone identifier spread) that may hold live getters
  // (props helpers' / compiled props objects): read inside the effect, which reactivity releases at once when the run
  // read no signal (a plain object retains no effect). No brand check: importing `props.ts` here would put it in the
  // resume runtime's graph (`_takeover`) and split a shared chunk off before the first interaction.
  else if (flags & 2) _bindingEffect(() => run((value ?? {}) as Record<string, unknown>));
  else {
    const object = (value ?? {}) as Record<string, unknown>;
    let accessor = false;
    for (const key in object) if (typeof object[key] === "function" && !isOn(key)) accessor = true;
    if (accessor) _bindingEffect(() => run(object));
    else run(object);
  }
  if (kids && !keep) _insert(el, kids, null);
}
// `_attrs` name lists (compiler literals) → their arrays, split once per distinct string.
let shapes: Map<string, readonly string[]> | undefined;
/**
 * Compiler ABI: the explicit attributes after an element's last `{...spread}` (whose `_spread` gets their names as
 * `exclude`, so they win over the spread's keys even when unset). `value` holds their values in `names` order (space
 * separated, compile-time validated, `className` / `htmlFor` normalized): a thunk when any can read state, diffed per
 * index by one binding. Same per-key rules as a spread key: accessor values are read inside the binding (an accessor
 * `checked` / `value` is re-asserted when unchanged), `class` → the class writer (HTML), `style` → the style object
 * writer, other names → the full attribute writer. First run: an unset value the element does not carry writes nothing.
 */
export function _attrs(el: Element, value: unknown[] | (() => unknown[]), names: string): void {
  let list = (shapes ??= new Map()).get(names);
  if (!list) shapes.set(names, (list = names.split(" ")));
  const keys = list,
    html = el.namespaceURI === HTML;
  let prev: unknown[] | undefined,
    style: ReadonlySet<string> = NONE;
  const run = (next: unknown[]): void => {
    for (let i = 0; i < keys.length; i++) {
      const name = keys[i]!;
      let v = next[i],
        live = false;
      if (typeof v === "function") ((next[i] = v = (v as () => unknown)()), (live = true));
      if (prev === undefined ? v == null && !el.hasAttribute(name) : Object.is(prev[i], v)) {
        // As a spread key: a controlled (accessor) `checked` / `value` drifted by the user is restored. Property only.
        if (live && prev !== undefined && v != null && (name === "checked" || name === "value") && name in el) {
          const want = name === "checked" ? Boolean(v) : String(v);
          if ((el as unknown as Record<string, unknown>)[name] !== want) (el as unknown as Record<string, unknown>)[name] = want;
        }
        continue;
      }
      if (name === "class" && html) _cls(el, v);
      else if (name === "style") style = _applyStyle(el, v, style);
      else _attrWrite(el, name, v);
    }
    prev = next;
  };
  if (typeof value === "function") _bindingEffect(() => run((value as () => unknown[])()));
  else if (value.some((v) => typeof v === "function")) _bindingEffect(() => run(value.slice()));
  else run(value);
}
