// FormData → typed schema input. The same function runs in the browser (from the form's DOM) and
// in `action()` (from the request body), so client and server validate identical input.
import { byPattern, isIndex, joinPath, parsePath } from "./path.ts";

/** How a field's FormData string(s) become schema input. Unlisted fields stay strings. */
export type Coercion = "string" | "number" | "boolean" | "array" | "file" | "date" | "json";
/** Field pattern → coercion; `$` matches any array index (`"items.$.qty": "number"`). */
export type CoerceMap = Readonly<Record<string, Coercion>>;
/** Limits applied while decoding FormData. */
export interface DecodeLimits {
  /** Max FormData entries (default 1000). */
  readonly fields: number;
  /** Max field name length (default 256). */
  readonly keyLength: number;
  /** Max path depth (default 8). */
  readonly depth: number;
  /** Max array index (default 1000); sparse indices are compacted. */
  readonly index: number;
}
/** Options of FormData decoding: coercions, empty values and limits. */
export interface DecodeOptions {
  readonly coerce?: CoerceMap | undefined;
  /** Empty strings: `undefined` (default, so optional fields validate) or kept as `""`. */
  readonly emptyAs?: "undefined" | "string" | undefined;
  readonly limits?: Partial<DecodeLimits> | undefined;
}
export const DEFAULT_LIMITS: DecodeLimits = { fields: 1000, keyLength: 256, depth: 8, index: 1000 };
/** Hidden protocol fields (form id, intent buttons, CSRF token, draft id, wizard step): never input. */
export const META_FIELDS: ReadonlySet<string> = new Set(["_form", "_intent", "_csrf", "_draft", "_step", "_version"]);

/** Malformed or oversized form data (the server answers 400). */
export class FormDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormDecodeError";
  }
}

type Entry = string | File;
const isFile = (value: unknown): value is File => typeof File !== "undefined" && value instanceof File;

function coerceOne(value: Entry, kind: Coercion | undefined, emptyAs: DecodeOptions["emptyAs"]): unknown {
  if (isFile(value)) return value.size === 0 && value.name === "" ? undefined : value;
  switch (kind) {
    case "number": {
      if (value.trim() === "") return undefined;
      const number = Number(value);
      // Not a number: keep the string, so the schema reports a type issue instead of NaN slipping through.
      return Number.isNaN(number) ? value : number;
    }
    case "boolean":
      return value === "" || value === "off" || value === "false" || value === "0" ? false : true;
    case "file":
      return undefined; // a string where a file was expected (no multipart): treated as absent
    case "date": {
      if (value === "") return undefined;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date;
    }
    case "json":
      if (value === "") return undefined;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    default:
      return value === "" && emptyAs !== "string" ? undefined : value;
  }
}

type Node = Map<string, unknown>; // segment → child (Map) or leaf value; compacted to objects/arrays at the end
const LEAF = Symbol("leaf");
type Leaf = { [LEAF]: unknown };

/** Decode FormData entries (or any `[name, value]` iterable) into nested schema input. */
export function decodeFormData(entries: Iterable<[string, FormDataEntryValue]>, options: DecodeOptions = {}): Record<string, unknown> {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const coerce = options.coerce;
  const root: Node = new Map();
  let count = 0;
  for (const [rawName, value] of entries) {
    if (META_FIELDS.has(rawName)) continue;
    if (++count > limits.fields) throw new FormDecodeError(`Too many form fields (max ${limits.fields})`);
    if (rawName.length > limits.keyLength) throw new FormDecodeError(`Form field name too long (max ${limits.keyLength})`);
    const segments = parsePath(rawName);
    if (!segments) throw new FormDecodeError(`Invalid form field name "${rawName.slice(0, 64)}"`);
    const append = segments[segments.length - 1] === "";
    if (append) segments.pop();
    if (!segments.length) throw new FormDecodeError(`Invalid form field name "${rawName.slice(0, 64)}"`);
    if (segments.length > limits.depth) throw new FormDecodeError(`Form field nested too deep (max ${limits.depth})`);
    for (const segment of segments) if (isIndex(segment) && Number(segment) > limits.index) throw new FormDecodeError(`Form array index too large (max ${limits.index})`);
    const name = joinPath(segments);
    const kind = byPattern(coerce, name);
    const item = coerceOne(value as Entry, kind === "array" ? undefined : kind, options.emptyAs);
    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]!;
      let child = node.get(segment);
      if (!(child instanceof Map)) node.set(segment, (child = new Map()));
      node = child as Node;
    }
    const last = segments[segments.length - 1]!;
    if (kind === "array" || append) {
      const existing = node.get(last) as Leaf | undefined;
      const list = existing && LEAF in existing && Array.isArray(existing[LEAF]) ? (existing[LEAF] as unknown[]) : [];
      if (item !== undefined) list.push(item);
      node.set(last, { [LEAF]: list });
    } else node.set(last, { [LEAF]: item }); // duplicate scalar names: last wins
  }
  const out = compact(root) as Record<string, unknown>;
  if (coerce) applyDefaults(out, coerce);
  return out;
}

/** Maps → plain objects; all-index maps → dense arrays in index order. */
function compact(node: Node): unknown {
  const keys = [...node.keys()];
  const indexed = keys.length > 0 && keys.every(isIndex);
  if (indexed) {
    keys.sort((a, b) => Number(a) - Number(b));
    return keys.map((key) => unwrap(node.get(key)));
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = unwrap(node.get(key));
    if (value !== undefined) out[key] = value;
  }
  return out;
}
const unwrap = (value: unknown): unknown => (value instanceof Map ? compact(value) : (value as Leaf)[LEAF]);

/** Absent checkboxes and multi-selects submit nothing: booleans default to false, arrays to []. */
function applyDefaults(out: Record<string, unknown>, coerce: CoerceMap): void {
  for (const pattern in coerce) {
    const kind = coerce[pattern];
    if (kind !== "boolean" && kind !== "array") continue;
    const empty = () => (kind === "boolean" ? false : []);
    fill(out, pattern.split("."), 0, empty);
  }
}
function fill(container: unknown, segments: string[], at: number, empty: () => unknown): void {
  if (container === null || typeof container !== "object") return;
  const segment = segments[at]!;
  const last = at === segments.length - 1;
  if (segment === "$") {
    if (!Array.isArray(container)) return;
    for (let i = 0; i < container.length; i++) {
      if (last) {
        if (container[i] === undefined) container[i] = empty();
      } else fill(container[i], segments, at + 1, empty);
    }
    return;
  }
  const record = container as Record<string, unknown>;
  if (last) {
    if (record[segment] === undefined) record[segment] = empty();
    return;
  }
  // Only descend into containers that exist (or plain object parents of a non-wildcard path).
  if (record[segment] === undefined) {
    if (segments.slice(at + 1).includes("$")) return;
    record[segment] = {};
  }
  fill(record[segment], segments, at + 1, empty);
}

/** Raw submitted values by canonical name (strings; repeated names → arrays), for echoing back. */
export function rawValues(entries: Iterable<[string, FormDataEntryValue]>, keep: (name: string, value: FormDataEntryValue) => boolean): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [rawName, value] of entries) {
    if (META_FIELDS.has(rawName) || typeof value !== "string") continue;
    const segments = parsePath(rawName);
    if (!segments) continue;
    const append = segments[segments.length - 1] === "";
    if (append) segments.pop();
    const name = joinPath(segments);
    if (!keep(name, value)) continue;
    const existing = out[name];
    if (existing === undefined) out[name] = append ? [value] : value;
    else out[name] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return out;
}
