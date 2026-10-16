// Value previews for the panel: depth 1, never invoking user code. Accessors show as `get`, built-in
// state (Map/Set size, Date, RegExp, typed array length) is read through the intrinsic getters, and any
// trap that throws (proxies) degrades the preview instead of reaching the page. Children load lazily
// (`inspect`, one page at a time) through handles.
import type { Entry, Inspected, Preview } from "../protocol.ts";

const MAX_STRING = 120, MAX_KEYS = 5, MAX_HANDLES = 1000;
/** Entries per `inspect` page; full text of a long string (`value.text`) up to this many chars. */
export const PAGE = 100, MAX_TEXT = 65_536;
const intrinsic = (proto: object, key: PropertyKey) => Object.getOwnPropertyDescriptor(proto, key)!.get!;
const mapSize = intrinsic(Map.prototype, "size"), setSize = intrinsic(Set.prototype, "size");
const TypedArray = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedLength = intrinsic(TypedArray, "length"), typedTag = intrinsic(TypedArray, Symbol.toStringTag);
const bufferLength = intrinsic(ArrayBuffer.prototype, "byteLength"), viewLength = intrinsic(DataView.prototype, "byteLength");
const isArray = Array.isArray, dateTime = Date.prototype.getTime;
const fnSource = Function.prototype.toString;
const isTyped = (value: object): boolean => ArrayBuffer.isView(value) && typedTag.call(value) !== undefined;
const regexSource = intrinsic(RegExp.prototype, "source");
// Flag getters in `RegExp.prototype.flags` order; each checks the regexp brand, absent ones are skipped.
const FLAGS = (["hasIndices", "global", "ignoreCase", "multiline", "dotAll", "unicode", "unicodeSets", "sticky"] as const)
  .map((key, i) => [Object.getOwnPropertyDescriptor(RegExp.prototype, key)?.get, "dgimsuvy"[i]!] as const)
  .filter((entry): entry is readonly [() => boolean, string] => entry[0] !== undefined);
const regexFlags = (value: object): string => FLAGS.map(([get, flag]) => (get.call(value) ? flag : "")).join("");
const nodeType = typeof Node !== "undefined" ? intrinsic(Node.prototype, "nodeType") : null;
const isError = (Error as { isError?: (value: unknown) => boolean }).isError;
/** Whether an intrinsic getter / method accepts `value` (its internal-slot brand check), never user code. */
const branded = (check: Function, value: object): boolean => {
  try {
    check.call(value);
    return true;
  } catch {
    return false;
  }
};
/** `Symbol.toStringTag` from the prototype chain's data properties (accessors never invoked). */
function tagOf(value: object): unknown {
  for (let proto: object | null = Object.getPrototypeOf(value); proto !== null; proto = Object.getPrototypeOf(proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, Symbol.toStringTag);
    if (descriptor) return "value" in descriptor ? descriptor.value : undefined;
  }
  return undefined;
}
export type Brand = "map" | "set" | "date" | "re" | "buffer" | "view" | "prom" | "err" | "dom";
/**
 * Built-in kind of an object from internal-slot brand checks (intrinsic getters / methods of this realm
 * accept objects of any realm), not `instanceof`: values from an iframe's realm preview and edit as what
 * they are. Promises have no side-effect-free brand check: `instanceof`, else their `Symbol.toStringTag`
 * data property; errors use `Error.isError` where available.
 */
export function brandOf(value: object): Brand | null {
  if (branded(mapSize, value)) return "map";
  if (branded(setSize, value)) return "set";
  if (branded(dateTime, value)) return "date";
  if (value !== RegExp.prototype && branded(regexSource, value)) return "re";
  if (branded(bufferLength, value)) return "buffer";
  if (branded(viewLength, value)) return "view";
  if (value instanceof Promise || tagOf(value) === "Promise") return "prom";
  if (nodeType && branded(nodeType, value)) return "dom";
  if (isError ? isError(value) : value instanceof Error) return "err";
  return null;
}
/** `Object.prototype` of any realm: a null-prototype object whose `constructor` is a function named `Object`. */
function isObjectPrototype(proto: object): boolean {
  if (proto === Object.prototype) return true;
  if (Object.getPrototypeOf(proto) !== null) return false;
  const ctor = own(proto, "constructor")?.value;
  return typeof ctor === "function" && own(ctor, "name")?.value === "Object";
}
/** A plain object (prototype `Object.prototype` of any realm, or null). */
export function isPlain(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === null || isObjectPrototype(proto);
}

/** Capped handle table (least recently used dropped) for lazy expansion: objects and long strings. */
export class Handles {
  private map = new Map<number, unknown>();
  private next = 1;
  add(value: unknown): number {
    const h = this.next++;
    this.map.set(h, value);
    if (this.map.size > MAX_HANDLES) this.map.delete(this.map.keys().next().value!);
    return h;
  }
  has(h: number): boolean {
    return this.map.has(h);
  }
  get(h: number): unknown {
    const value = this.map.get(h);
    if (value !== undefined) {
      this.map.delete(h);
      this.map.set(h, value);
    }
    return value;
  }
  clear(): void {
    this.map.clear();
  }
}

export interface PreviewOptions {
  handles?: Handles;
  /** A signal getter's current value (read without tracking) and id, or undefined when `fn` is not a signal. */
  signal?: (fn: Function) => { value: unknown; id?: number } | undefined;
}

const quote = (value: string, max = MAX_STRING) => JSON.stringify(value.slice(0, max)).slice(0, -1) + (value.length > max ? '…"' : '"');
function text(value: string, options: PreviewOptions = {}): Preview {
  if (value.length <= MAX_STRING) return { k: "s", p: JSON.stringify(value) };
  const h = options.handles?.add(value);
  return { k: "trunc", p: quote(value), n: value.length, ...(h !== undefined ? { h } : {}) };
}
/** A data property's value, or undefined for accessors (never invoked). */
function own(value: object, key: PropertyKey): { value: unknown } | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? { value: descriptor.value } : undefined;
}
/** Constructor name from the prototype chain's data properties. */
function className(value: object): string {
  let proto: object | null = Object.getPrototypeOf(value);
  while (proto !== null) {
    const ctor = own(proto, "constructor")?.value;
    if (typeof ctor === "function") {
      const name = own(ctor, "name")?.value;
      if (typeof name === "string" && name) return name;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return "Object";
}
const isNode = (value: object): value is Node => nodeType !== null && branded(nodeType, value);
function domLabel(node: Node): string {
  if (node.nodeType === 3) return "#text " + quote(node.nodeValue ?? "", 40);
  if (node.nodeType === 8) return "<!--" + (node.nodeValue ?? "").slice(0, 40) + "-->";
  if (node.nodeType !== 1) return node.nodeName.toLowerCase();
  const element = node as Element;
  return "<" + element.localName + (element.id ? "#" + element.id : "") + (element.classList.length ? "." + [...element.classList].slice(0, 3).join(".") : "") + ">";
}
/** Instances of a class (prototype other than `Object.prototype` of any realm / null): their prototype accessors are listed. */
const isInstance = (value: object): boolean => !isPlain(value);

/** Preview of any value, without calling getters, `toString`/`toJSON` or proxy-unsafe operations beyond key listing. */
export function preview(value: unknown, options: PreviewOptions = {}): Preview {
  try {
    switch (typeof value) {
      case "undefined":
        return { k: "u", p: "undefined" };
      case "number":
        return { k: "n", p: Object.is(value, -0) ? "-0" : String(value) };
      case "string":
        return text(value, options);
      case "boolean":
        return { k: "b", p: String(value) };
      case "bigint":
        return { k: "big", p: value + "n" };
      case "symbol":
        return { k: "sym", p: value.description === undefined ? "Symbol()" : "Symbol(" + value.description + ")" };
      case "function": {
        const signal = options.signal?.(value);
        if (signal) {
          const inner = preview(signal.value, options);
          return { k: "sig", p: "signal(" + inner.p + ")", ...(inner.h !== undefined ? { h: inner.h } : {}), ...(signal.id !== undefined ? { sid: signal.id } : {}) };
        }
        const name = own(value, "name")?.value, shown = typeof name === "string" && name ? name : "anonymous";
        return { k: "fn", p: /^class\b/.test(fnSource.call(value)) ? "class " + shown : "ƒ " + shown + "()" };
      }
    }
    if (value === null) return { k: "u", p: "null" };
    const object = value as object;
    const handle = (): { h?: number } => {
      const h = options.handles?.add(object);
      return h !== undefined ? { h } : {};
    };
    if (isArray(object)) {
      const length = own(object, "length")?.value as number;
      return { k: "a", p: "Array(" + length + ")", n: length, ...(length ? handle() : {}) };
    }
    if (isTyped(object)) {
      const length = typedLength.call(object) as number;
      return { k: "a", p: typedTag.call(object) + "(" + length + ")", n: length, c: "typed", ...(length ? handle() : {}) };
    }
    const brand = brandOf(object);
    switch (brand) {
      case "buffer":
        return { k: "o", p: "ArrayBuffer(" + bufferLength.call(object) + ")" };
      case "view":
        return { k: "o", p: "DataView(" + viewLength.call(object) + ")" };
      case "map": {
        const size = mapSize.call(object) as number;
        return { k: "map", p: "Map(" + size + ")", n: size, ...(size ? handle() : {}) };
      }
      case "set": {
        const size = setSize.call(object) as number;
        return { k: "set", p: "Set(" + size + ")", n: size, ...(size ? handle() : {}) };
      }
      case "date": {
        const time = dateTime.call(object);
        return { k: "date", p: Number.isNaN(time) ? "Invalid Date" : new Date(time).toISOString() };
      }
      case "re":
        return { k: "re", p: "/" + (regexSource.call(object) as string) + "/" + regexFlags(object) };
      case "prom":
        return { k: "prom", p: "Promise" };
      case "dom":
        return { k: "dom", p: domLabel(object as Node) };
      case "err": {
        const message = own(object, "message")?.value;
        return { k: "err", p: className(object) + (typeof message === "string" && message ? ": " + text(message).p.slice(1, -1) : ""), ...handle() };
      }
    }
    const keys = Object.keys(object);
    const name = className(object);
    const shown = keys.slice(0, MAX_KEYS).join(", ") + (keys.length > MAX_KEYS ? ", …" : "");
    const expandable = keys.length > 0 || isInstance(object) || Reflect.ownKeys(object).length > 0;
    return { k: "o", p: (name === "Object" ? "" : name + " ") + "{" + shown + "}", n: keys.length, c: isInstance(object) ? "inst" : "plain", ...(expandable ? handle() : {}) };
  } catch {
    return { k: "o", p: "(unreadable)" };
  }
}

export interface InspectOptions extends PreviewOptions {
  /** First entry of the page. */
  offset?: number;
  /** Objects on the path from the root down to the inspected value: children among them show `[circular]`. */
  ancestors?: readonly unknown[];
}
const CIRCULAR: Preview = { k: "cyc", p: "[circular]" };
const keyName = (key: PropertyKey): string => (typeof key === "symbol" ? "[" + preview(key).p + "]" : String(key));

/**
 * One page of an object's contents (`value.inspect`): own properties (accessors listed, not invoked) and,
 * for class instances, prototype accessors (`proto`, never invoked); array / typed array indices; Map / Set
 * entries. `total` counts every entry, so the panel can page on.
 */
export function inspect(value: object, options: InspectOptions = {}): Inspected {
  const offset = Math.max(0, options.offset ?? 0), end = offset + PAGE;
  const list: Entry[] = [];
  const seen = new Set<unknown>(options.ancestors ?? []).add(value);
  const child = (key: string, item: unknown, kh?: number): void => {
    list.push({ key, value: typeof item === "object" && item !== null && seen.has(item) ? CIRCULAR : preview(item, options), ...(kh !== undefined ? { kh } : {}) });
  };
  // Map keys and Set members get handles: edit paths address them by identity.
  const keyHandle = (key: unknown): number | undefined => options.handles?.add(key);
  let total = 0;
  try {
    const brand = brandOf(value);
    if (brand === "map") {
      total = mapSize.call(value) as number;
      let i = 0;
      for (const [key, item] of Map.prototype.entries.call(value) as MapIterator<[unknown, unknown]>) {
        if (i >= end) break;
        if (i++ >= offset) child(preview(key).p, item, keyHandle(key));
      }
      return { entries: list, total };
    }
    if (brand === "set") {
      total = setSize.call(value) as number;
      let i = 0;
      for (const item of Set.prototype.values.call(value) as SetIterator<unknown>) {
        if (i >= end) break;
        if (i >= offset) child(String(i), item, keyHandle(item));
        i++;
      }
      return { entries: list, total };
    }
    if (isArray(value) || isTyped(value)) {
      total = isArray(value) ? (own(value, "length")?.value as number) : (typedLength.call(value) as number);
      for (let i = offset; i < Math.min(total, end); i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor) list.push({ key: String(i), value: { k: "u", p: "<empty>" } });
        else if ("value" in descriptor) child(String(i), descriptor.value);
        else list.push({ key: String(i), value: { k: "get", p: "(getter)" } });
      }
      return { entries: list, total };
    }
    const keys: { key: PropertyKey; proto?: true }[] = Reflect.ownKeys(value).map((key) => ({ key }));
    if (isInstance(value) && !isNode(value)) {
      // Prototype accessors (`get total()`), once per name, never invoked; methods are left out.
      const names = new Set<PropertyKey>(keys.map((k) => k.key));
      for (let proto = Object.getPrototypeOf(value); proto !== null && !isObjectPrototype(proto); proto = Object.getPrototypeOf(proto))
        for (const key of Reflect.ownKeys(proto)) {
          if (names.has(key) || key === "constructor" || key === "__proto__") continue;
          const descriptor = Object.getOwnPropertyDescriptor(proto, key);
          if (!descriptor || "value" in descriptor) continue;
          names.add(key);
          keys.push({ key, proto: true });
        }
    }
    total = keys.length;
    for (const { key, proto } of keys.slice(offset, end)) {
      const descriptor = proto ? undefined : Object.getOwnPropertyDescriptor(value, key);
      if (!proto && !descriptor) continue;
      if (descriptor && "value" in descriptor) child(keyName(key), descriptor.value);
      else list.push({ key: keyName(key), value: { k: "get", p: descriptor && !descriptor.get ? "(setter)" : "(getter)" }, ...(proto ? { proto } : {}) });
    }
  } catch {
    list.push({ key: "…", value: { k: "o", p: "(unreadable)" } });
  }
  return { entries: list, total };
}

/** The first page of `value`'s entries (props, context). */
export const entries = (value: object, options: PreviewOptions = {}): Entry[] => inspect(value, options).entries;

/** Whether the panel may edit a value as JSON: primitives, arrays and plain objects of them, no cycles. */
export function jsonSafe(value: unknown, depth = 0, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || depth > 20 || seen.has(value)) return false;
  try {
    if (!isArray(value) && !isPlain(value)) return false;
    const keys = Reflect.ownKeys(value);
    // A sparse array's holes would come back as `null` from a JSON round trip.
    if (isArray(value) && keys.length !== (own(value, "length")?.value as number) + 1) return false;
    seen.add(value);
    for (const key of keys) {
      if (typeof key === "symbol") return false;
      if (isArray(value) && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!("value" in descriptor) || !jsonSafe(descriptor.value, depth + 1, seen)) return false;
    }
    seen.delete(value);
    return true;
  } catch {
    return false;
  }
}

/** JSON-safe `value` with the existing leaf at `path` replaced by `next`, as a fresh copy (equality sees a change). */
export function setPath(value: unknown, path: readonly string[], next: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!path.length) return { ok: true, value: next };
  if (!jsonSafe(value)) return { ok: false, error: "only JSON values can be edited" };
  const copy = JSON.parse(JSON.stringify(value)) as unknown;
  let at = copy;
  for (let i = 0; i < path.length; i++) {
    const key = path[i]!;
    if (typeof at !== "object" || at === null || !Object.hasOwn(at, key)) return { ok: false, error: "no value at " + path.slice(0, i + 1).join(".") };
    if (i === path.length - 1) (at as Record<string, unknown>)[key] = next;
    else at = (at as Record<string, unknown>)[key];
  }
  return { ok: true, value: copy };
}
