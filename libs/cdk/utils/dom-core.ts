// Core DOM helpers (BIG-UI leaf): owner document / window, event targets, active element, shadow-DOM-safe
// containment, CSS.escape. Split out of `./dom.ts` (which re-exports it) so the interaction hooks every cdk
// component imports do not pull scrolling / viewport / nonce code into a page's chunks.
// Ported from react-spectrum packages/react-aria/src/utils/domHelpers.ts and shadowdom/DOMFunctions.ts
// (Apache-2.0, © Adobe).
// `DEV` (`#dev`) for cdk modules that import this file anyway: re-exported here instead of a direct `#dev` import, which would add
// a module edge per importer and regroup merge chunks (DIET-CODE 2026-10-22: +1 eager chunk on 3 cdk story pages).
export { DEV } from "#dev";

/**
 * `CSS.escape(value)` (CSSOM "serialize an identifier"): the native one when the global `CSS` exists, else the same
 * algorithm in JS. React Aria calls `CSS.escape` directly; environments without the global (happy-dom / jsdom set it on
 * `window` only, older embedded webviews) would throw inside an event handler, so every cdk selector goes through this.
 */
export function cssEscape(value: string): string {
  const native = (globalThis as { CSS?: { escape?: (value: string) => string } }).CSS;
  if (native && typeof native.escape === "function") return native.escape(value);
  const string = String(value);
  const length = string.length;
  const first = string.charCodeAt(0);
  let result = "";
  for (let index = 0; index < length; index++) {
    const code = string.charCodeAt(index);
    if (code === 0x0000) result += "�";
    else if (
      (code >= 0x0001 && code <= 0x001f) ||
      code === 0x007f ||
      (index === 0 && code >= 0x0030 && code <= 0x0039) ||
      (index === 1 && code >= 0x0030 && code <= 0x0039 && first === 0x002d)
    )
      result += "\\" + code.toString(16) + " ";
    else if (index === 0 && length === 1 && code === 0x002d) result += "\\" + string.charAt(index);
    else if (
      code >= 0x0080 ||
      code === 0x002d ||
      code === 0x005f ||
      (code >= 0x0030 && code <= 0x0039) ||
      (code >= 0x0041 && code <= 0x005a) ||
      (code >= 0x0061 && code <= 0x007a)
    )
      result += string.charAt(index);
    else result += "\\" + string.charAt(index);
  }
  return result;
}

/** Type guard: a DOM Node (has a numeric `nodeType`). */
export function isNode(value: unknown): value is Node {
  return value !== null && typeof value === "object" && "nodeType" in value && typeof (value as Node).nodeType === "number";
}
function isWindow(value: unknown): value is Window & typeof globalThis {
  return typeof value === "object" && value != null && "window" in value && (value as Window).window === value;
}
/** Type guard: a Document (`nodeType` 9). */
export function isDocument(value: unknown): value is Document {
  return isNode(value) && value.nodeType === 9;
}
/** Type guard: a ShadowRoot (document fragment with a `host`). */
export function isShadowRoot(value: unknown): value is ShadowRoot {
  return isNode(value) && value.nodeType === 11 && "host" in value;
}

/** The document `target` belongs to (window → its document; iframe content → the iframe's document). */
export const getOwnerDocument = (target?: EventTarget | null): Document => {
  if (isWindow(target)) return target.document;
  if (isDocument(target)) return target;
  return (target as Node | null | undefined)?.ownerDocument ?? (typeof document !== "undefined" ? document : (undefined as unknown as Document));
};

/** The window `target` belongs to. */
export const getOwnerWindow = (target?: EventTarget | null): Window & typeof globalThis => {
  const ownerDocument = getOwnerDocument(target);
  return (ownerDocument?.defaultView ?? (typeof window !== "undefined" ? window : undefined)) as Window & typeof globalThis;
};

/** Attach `listener` to one or several targets; returns the cleanup. Null target / listener → no-op. */
export function addEvent(
  target: EventTarget | EventTarget[] | null | undefined,
  event: string,
  listener?: ((event: any) => unknown) | null,
  options?: boolean | AddEventListenerOptions,
): () => void {
  if (listener == null || target == null) return () => {};
  const targets = Array.isArray(target) ? target : [target];
  for (const t of targets) t.addEventListener(event, listener as EventListener, options);
  return () => {
    for (const t of targets) t.removeEventListener(event, listener as EventListener, options);
  };
}

/** Set a CSS property (with optional priority) on element(s); the cleanup restores each previous value. */
export function setStyle(target: HTMLElement | HTMLElement[] | null, property: string, value: string, priority?: string): () => void {
  if (target == null) return () => {};
  const restore: (() => void)[] = [];
  for (const el of Array.isArray(target) ? target : [target]) {
    const initialValue = el.style.getPropertyValue(property);
    const initialPriority = el.style.getPropertyPriority(property);
    el.style.setProperty(property, value, priority);
    restore.unshift(() => {
      if (initialValue) el.style.setProperty(property, initialValue, initialPriority);
      else el.style.removeProperty(property);
    });
  }
  return () => {
    for (const cleanup of restore) cleanup();
  };
}

/** Shadow-DOM-safe `node.contains(otherNode)`: crosses shadow roots (via `host`) and slots. */
export function nodeContains(node: Node | null | undefined, otherNode: Node | EventTarget | null | undefined): boolean {
  if (!node || !otherNode || !isNode(otherNode)) return false;
  let current: Node | null | undefined = otherNode;
  while (current != null) {
    if (current === node) return true;
    const slotted = current as Node & { assignedSlot?: HTMLSlotElement | null; assignedElements?: unknown };
    if (typeof slotted.assignedElements !== "function" && slotted.assignedSlot?.parentNode) current = slotted.assignedSlot.parentNode;
    else if (isShadowRoot(current)) current = current.host;
    else current = current.parentNode;
  }
  return false;
}

/** Shadow-DOM-safe `document.activeElement` (descends into open shadow roots). */
export const getActiveElement = (doc: Document = document): Element | null => {
  let active: Element | null = doc.activeElement;
  while (active && "shadowRoot" in active && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
};

/** Shadow-DOM-safe `event.target`: the node inside an open shadow root when the listener is outside it. */
export function getEventTarget<T extends EventTarget = EventTarget>(event: Event): T | null {
  const target = event.target;
  if (typeof Element !== "undefined" && target instanceof Element && target.shadowRoot && "composedPath" in event)
    return (event.composedPath()[0] ?? null) as T | null;
  return target as T | null;
}

/**
 * Targets a listener must be attached to so it sees an event globally from `from`: `[to, …shadow
 * roots between from and to]` (`to` defaults to `from`'s window; `null` → none).
 */
export function getPropagationTargets(from: Element | null | undefined, to?: Document | Window | Element | null): EventTarget[] {
  if (to === null) return [];
  const destination = to ?? getOwnerWindow(from);
  const targets: EventTarget[] = [destination];
  if (!from || from === destination) return targets;
  const toRoot = "getRootNode" in destination ? (destination as Node).getRootNode() : null;
  let current: Node | null = from.getRootNode() ?? null;
  while (isShadowRoot(current) && current !== toRoot) {
    targets.push(current);
    current = current.host.getRootNode();
  }
  return targets;
}

/** Shadow-DOM-safe fast `node.contains(document.activeElement)`. */
export function isFocusWithin(node: Element | null | undefined): boolean {
  if (!node) return false;
  const root = node.getRootNode();
  const win = getOwnerWindow(node);
  if (!(root instanceof win.Document || root instanceof win.ShadowRoot)) return false;
  const active = (root as Document | ShadowRoot).activeElement;
  return active != null && node.contains(active);
}
