// Structured edits of page values from the panel (`value.edit`): typed leaf values, paths through
// objects, arrays, Map entries and Set members, and the container operations (add / remove keys,
// entries, members, items). Copyable containers on the path (arrays, plain objects, Map, Set, typed
// arrays) are copied, so the result is a fresh value an equality check sees as changed; a class
// instance on the path is mutated in place (copying it could drop private state or break identity),
// and when the root itself is one, the caller re-notifies instead of setting.
import type { Seg, Typed } from "../protocol.ts";
import { brandOf, isPlain } from "./preview.ts";

export type EditOp = { op: "set"; value: Typed } | { op: "delete" } | { op: "add"; key?: Typed; value: Typed };
export type Edited = { ok: true; value: unknown; inPlace: boolean } | { ok: false; error: string };

const BIGINT = /^-?\d+$/;
/** The page value a typed panel value stands for. */
export function decode(typed: Typed): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (typed.t) {
    case "s":
      return { ok: true, value: typed.v };
    case "n": {
      const text = typed.v.trim(), n = Number(text);
      return text === "NaN" || (text !== "" && !Number.isNaN(n)) ? { ok: true, value: n } : { ok: false, error: "not a number: " + typed.v };
    }
    case "b":
      return { ok: true, value: typed.v };
    case "big":
      return BIGINT.test(typed.v.trim()) ? { ok: true, value: BigInt(typed.v.trim()) } : { ok: false, error: "not an integer: " + typed.v };
    case "date": {
      const text = typed.v.trim();
      const date = /^-?\d+$/.test(text) ? new Date(Number(text)) : new Date(text);
      return Number.isNaN(date.getTime()) ? { ok: false, error: "not a date: " + typed.v } : { ok: true, value: date };
    }
    case "null":
      return { ok: true, value: null };
    case "u":
      return { ok: true, value: undefined };
    case "json":
      try {
        return { ok: true, value: JSON.parse(typed.v) };
      } catch (error) {
        return { ok: false, error: "invalid JSON: " + (error as Error).message };
      }
  }
}

type Kind = "array" | "typed" | "plain" | "map" | "set" | "instance";
function kindOf(value: unknown): Kind | null {
  if (typeof value !== "object" || value === null) return null;
  if (Array.isArray(value)) return "array";
  // Brand checks, not `instanceof`: containers from another realm (an iframe app) edit the same way.
  const brand = brandOf(value);
  if (ArrayBuffer.isView(value) && brand !== "view") return "typed";
  if (brand === "map" || brand === "set") return brand;
  if (brand) return null;
  return isPlain(value) ? "plain" : "instance";
}
/** Copy of a copyable container (instances are returned as is: edited in place). */
function copy(value: object, kind: Kind): object {
  switch (kind) {
    case "array":
      return (value as unknown[]).slice();
    case "typed":
      return (value as unknown as { slice(): object }).slice();
    case "map":
      return new Map(value as Map<unknown, unknown>);
    case "set":
      return new Set(value as Set<unknown>);
    case "plain": {
      // Data properties stay writable in the copy (a frozen original is frozen again after the edit).
      const descriptors = Object.getOwnPropertyDescriptors(value) as Record<PropertyKey, PropertyDescriptor>;
      for (const key of Reflect.ownKeys(descriptors)) {
        const descriptor = descriptors[key as string]!;
        if ("value" in descriptor) Object.assign(descriptor, { writable: true, configurable: true });
      }
      return Object.create(Object.getPrototypeOf(value) as object | null, descriptors) as object;
    }
    case "instance":
      return value;
  }
}
const frozen = (original: object, out: object): object => (Object.isFrozen(original) && out !== original ? Object.freeze(out) : out);

/** The key a segment addresses in `container`. */
function keyOf(seg: Seg, resolve: (h: number) => { found: boolean; value: unknown }): { ok: true; key: unknown } | { ok: false; error: string } {
  if ("o" in seg) return { ok: true, key: seg.o };
  const found = resolve("m" in seg ? seg.m : seg.s);
  return found.found ? { ok: true, key: found.value } : { ok: false, error: "the entry is gone (collapse and expand again)" };
}
function child(container: object, kind: Kind, seg: Seg, key: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (kind === "map") return (container as Map<unknown, unknown>).has(key) ? { ok: true, value: (container as Map<unknown, unknown>).get(key) } : { ok: false, error: "no such Map entry" };
  if (kind === "set") return (container as Set<unknown>).has(key) ? { ok: true, value: key } : { ok: false, error: "no such Set member" };
  if (!("o" in seg)) return { ok: false, error: "not a Map or Set" };
  const descriptor = Object.getOwnPropertyDescriptor(container, seg.o);
  if (!descriptor) return { ok: false, error: "no value at " + seg.o };
  if (!("value" in descriptor)) return { ok: false, error: seg.o + " is an accessor (never invoked by DevTools)" };
  return { ok: true, value: descriptor.value };
}
/** Write `next` at `key` of an already copied (or in-place) container. */
function put(container: object, kind: Kind, key: unknown, next: unknown): string | null {
  if (kind === "map") (container as Map<unknown, unknown>).set(key, next);
  else if (kind === "set") {
    // Replace a member, keeping its position.
    const set = container as Set<unknown>, items = [...set];
    set.clear();
    for (const item of items) set.add(Object.is(item, key) ? next : item);
  } else {
    const descriptor = Object.getOwnPropertyDescriptor(container, key as string);
    if (descriptor && !("value" in descriptor)) return String(key) + " is an accessor";
    if (descriptor && !descriptor.writable) return String(key) + " is read-only";
    if (Object.isFrozen(container)) return "the object is frozen";
    (container as Record<string, unknown>)[key as string] = next;
  }
  return null;
}

/**
 * Apply `op` at `path` of `root`. `set` / `delete` address the value at `path`; `add` the container
 * at `path`. `resolve` maps a Map key / Set member handle to its value.
 */
export function edit(root: unknown, path: readonly Seg[], op: EditOp, resolve: (h: number) => { found: boolean; value: unknown }): Edited {
  const decoded = op.op === "delete" ? { ok: true as const, value: undefined } : decode(op.value);
  if (!decoded.ok) return decoded;
  let decodedKey: unknown;
  if (op.op === "add" && op.key) {
    const key = decode(op.key);
    if (!key.ok) return key;
    decodedKey = key.value;
  }
  // The value with the edit applied at depth `at` (fresh where copyable).
  const rebuild = (value: unknown, at: number): { ok: true; value: unknown } | { ok: false; error: string } => {
    const target = op.op === "add" ? path.length : path.length - 1;
    if (op.op === "set" && path.length === 0) return { ok: true, value: decoded.value };
    if (op.op === "delete" && path.length === 0) return { ok: false, error: "nothing to remove" };
    const kind = kindOf(value);
    if (!kind) return { ok: false, error: "not a container" };
    if (at === target) return apply(value as object, kind);
    const seg = path[at]!;
    const key = keyOf(seg, resolve);
    if (!key.ok) return key;
    if (kind === "set") return { ok: false, error: "Set members are edited as a whole" };
    if (kind === "typed") return { ok: false, error: "typed arrays hold numbers only" };
    const current = child(value as object, kind, seg, key.key);
    if (!current.ok) return current;
    const inner = rebuild(current.value, at + 1);
    if (!inner.ok) return inner;
    const out = copy(value as object, kind);
    const failure = put(out, kind, key.key, inner.value);
    return failure ? { ok: false, error: failure } : { ok: true, value: frozen(value as object, out) };
  };
  const apply = (container: object, kind: Kind): { ok: true; value: unknown } | { ok: false; error: string } => {
    const out = copy(container, kind);
    if (op.op === "add") {
      switch (kind) {
        case "array":
          (out as unknown[]).push(decoded.value);
          break;
        case "map":
          if (decodedKey === undefined && !op.key) return { ok: false, error: "a Map entry needs a key" };
          if ((out as Map<unknown, unknown>).has(decodedKey)) return { ok: false, error: "the Map has that key already" };
          (out as Map<unknown, unknown>).set(decodedKey, decoded.value);
          break;
        case "set":
          (out as Set<unknown>).add(decoded.value);
          break;
        case "typed":
          return { ok: false, error: "typed arrays have a fixed length" };
        default: {
          if (typeof decodedKey !== "string" || !decodedKey) return { ok: false, error: "a property needs a name" };
          if (Object.hasOwn(out, decodedKey)) return { ok: false, error: decodedKey + " exists already" };
          if (!Object.isExtensible(out)) return { ok: false, error: "the object is not extensible" };
          (out as Record<string, unknown>)[decodedKey] = decoded.value;
        }
      }
      return { ok: true, value: frozen(container, out) };
    }
    const seg = path[path.length - 1]!;
    const key = keyOf(seg, resolve);
    if (!key.ok) return key;
    const current = child(container, kind, seg, key.key);
    if (!current.ok) return current;
    if (op.op === "delete") {
      switch (kind) {
        case "array": {
          const index = Number(key.key);
          (out as unknown[]).splice(index, 1);
          break;
        }
        case "map":
          (out as Map<unknown, unknown>).delete(key.key);
          break;
        case "set":
          (out as Set<unknown>).delete(key.key);
          break;
        case "typed":
          return { ok: false, error: "typed arrays have a fixed length" };
        default: {
          const descriptor = Object.getOwnPropertyDescriptor(out, key.key as string);
          if (descriptor && !descriptor.configurable) return { ok: false, error: String(key.key) + " cannot be removed" };
          delete (out as Record<string, unknown>)[key.key as string];
        }
      }
      return { ok: true, value: frozen(container, out) };
    }
    if (kind === "typed") {
      if (typeof decoded.value !== "number" && typeof decoded.value !== "bigint") return { ok: false, error: "typed arrays hold numbers only" };
      (out as unknown as Record<string, unknown>)[key.key as string] = decoded.value;
      return { ok: true, value: out };
    }
    const failure = put(out, kind, key.key, decoded.value);
    return failure ? { ok: false, error: failure } : { ok: true, value: frozen(container, out) };
  };
  const result = rebuild(root, 0);
  if (!result.ok) return result;
  // Only an instance root comes back as itself: it was edited in place.
  return { ok: true, value: result.value, inPlace: result.value === root && kindOf(root) === "instance" };
}
