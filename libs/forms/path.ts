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

/**
 * Whether `path` matches `pattern`, where a `$` segment matches any array index. Segment by segment in place (no
 * `split`): `decodeFormData` asks it per FormData entry per `$` coerce pattern on every keystroke (FIX-CORE 2026-11-01:
 * 100 entries × 9 patterns, decode 99 → 36 µs).
 */
export function matchesPattern(pattern: string, path: string): boolean {
  if (pattern === path) return true;
  if (!pattern.includes("$")) return false;
  for (let i = 0, j = 0; ;) {
    let a = pattern.indexOf(".", i),
      b = path.indexOf(".", j);
    if (a < 0) a = pattern.length;
    if (b < 0) b = path.length;
    if (!sameSegment(pattern, i, a, path, j, b) && !(a - i === 1 && pattern.charCodeAt(i) === 36 && indexAt(path, j, b))) return false;
    // The last segment of either: both must end here (equal segment counts).
    if (a === pattern.length || b === path.length) return a === pattern.length && b === path.length;
    i = a + 1;
    j = b + 1;
  }
}
const sameSegment = (a: string, i: number, ae: number, b: string, j: number, be: number): boolean => {
  if (ae - i !== be - j) return false;
  for (; i < ae; i++, j++) if (a.charCodeAt(i) !== b.charCodeAt(j)) return false;
  return true;
};
// `isIndex` over `text[from, to)`: `0` or digits without a leading zero.
const indexAt = (text: string, from: number, to: number): boolean => {
  if (from === to || (text.charCodeAt(from) === 48 && to - from > 1)) return false;
  for (let k = from; k < to; k++) {
    const c = text.charCodeAt(k);
    if (c < 48 || c > 57) return false;
  }
  return true;
};

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

const SECRET_PART = /pass(?:word|wd|phrase|code)|secret/i;
const SECRET_WORDS = new Set([
  "pass",
  "pwd",
  "token",
  "otp",
  "totp",
  "pin",
  "cvc",
  "cvv",
  "cvv2",
  "csc",
  "ssn",
  "iban",
  "apikey",
  "cardnumber",
  "ccnumber",
  "ccnum",
]);
const SECRET_PAIRS = new Set([
  "api key",
  "private key",
  "access key",
  "secret key",
  "card number",
  "card num",
  "card no",
  "cc number",
  "cc num",
  "security code",
]);
/**
 * A field path that names a secret: never echoed after a failed POST, autosaved, stored as a draft or shown unmasked
 * by the devtools. Contains `password` / `passwd` / `passphrase` / `passcode` / `secret` anywhere, or has a word (split
 * on punctuation and camelCase) `pass`, `pwd`, `token`, `otp`, `totp`, `pin`, `cvc`, `cvv`, `csc`, `ssn`, `iban`,
 * `apiKey`, `cardNumber`, `ccNumber` (`user.pinCode`, `billing.card_number`, `items.0.cvv`; not `shipping`).
 */
export function secretName(path: string): boolean {
  if (SECRET_PART.test(path)) return true;
  const words = path
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z\d]+/);
  for (let i = 0; i < words.length; i++) {
    if (SECRET_WORDS.has(words[i]!) || (i + 1 < words.length && SECRET_PAIRS.has(words[i] + " " + words[i + 1]))) return true;
  }
  return false;
}
