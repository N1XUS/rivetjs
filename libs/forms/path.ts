// Field path strings (FormData names): dotted (`items.0.qty`, the canonical form) or bracket
// (`items[0][qty]`, `items[0].qty`, `tags[]`) on decode. Hardened against prototype pollution.

/** Segments that never become object keys. */
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);
export const isIndex = (segment: string): boolean => /^(0|[1-9]\d*)$/.test(segment);

/**
 * Split a field name into segments; `""` marks an append (`tags[]`). Returns null for malformed or
 * forbidden names (empty segments, `__proto__`/`constructor`/`prototype`, unbalanced brackets).
 */
export function parsePath(name: string): string[] | null {
  const out: string[] = [];
  let i = 0;
  const n = name.length;
  if (!n) return null;
  while (i < n) {
    const ch = name[i]!;
    if (ch === "[") {
      const end = name.indexOf("]", i);
      if (end < 0) return null;
      out.push(name.slice(i + 1, end));
      i = end + 1;
      if (i < n && name[i] === ".") {
        i++;
        if (i === n) return null;
      }
      continue;
    }
    let end = i;
    while (end < n && name[end] !== "." && name[end] !== "[") end++;
    const part = name.slice(i, end);
    if (!part) return null;
    out.push(part);
    i = end;
    if (i < n && name[i] === ".") {
      i++;
      if (i === n) return null;
    }
  }
  for (let k = 0; k < out.length; k++) {
    const part = out[k]!;
    if (FORBIDDEN.has(part)) return null;
    // An append marker only ends a path.
    if (part === "" && k !== out.length - 1) return null;
  }
  return out;
}

/** Canonical dotted name for segments (inverse of `parsePath` for dotted names). */
export const joinPath = (segments: readonly (string | number)[]): string => segments.join(".");

/** Canonical dotted form of any accepted name (`items[0][qty]` → `items.0.qty`); null when invalid. */
export function canonicalName(name: string): string | null {
  const segments = parsePath(name);
  return segments && !segments.includes("") ? joinPath(segments) : null;
}

/** Whether `path` matches `pattern`, where a `$` segment matches any array index. */
export function matchesPattern(pattern: string, path: string): boolean {
  if (pattern === path) return true;
  if (!pattern.includes("$")) return false;
  const a = pattern.split("."), b = path.split(".");
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !(a[i] === "$" && isIndex(b[i]!))) return false;
  return true;
}

/** Look a value up in a `{ pattern: value }` map (exact first, then `$` wildcards). */
export function byPattern<V>(map: Readonly<Record<string, V>> | undefined, path: string): V | undefined {
  if (!map) return undefined;
  if (Object.hasOwn(map, path)) return map[path];
  for (const pattern in map) if (pattern.includes("$") && matchesPattern(pattern, path)) return map[pattern];
  return undefined;
}

/** Read a nested value by dotted path (`undefined` when any step is missing). */
export function getAt(value: unknown, path: string): unknown {
  if (path === "") return value;
  let current = value;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object" || FORBIDDEN.has(segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Id-safe form of a path (`items.0.qty` → `items-0-qty`). */
export const idSafe = (path: string): string => path.replace(/[^A-Za-z0-9_-]/g, "-");
