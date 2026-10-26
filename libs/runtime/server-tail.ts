// Boundaries tail encoder, wire format v2 (ZERO S2 / S3, 2026-10-25; server only: `server-derived.ts` calls it, no client
// chunk imports it). A flush's records by name become: a names table `n` (each distinct boundary name once, with its chunk
// as an index into the URL table `u` and its listened event types), records `[id, parent, flags, name index, keyed values?,
// props?]` (values left out when empty and no props) and runs of stateless records with consecutive ids — `[id, 0, 0, -1,
// count, tmpl]`, period 1–4, each template slot's parent absolute (`>= 0`) or relative to the record's id (`< 0`). The
// tail grows with the distinct record shapes of a page, not with its instances: 1000 sibling counters (LIT keys unwritten)
// are one run, a year picker's ui cell → cdk cell pairs one run of period 2. Decoder: `resume-format.ts` `eachRecord` /
// `recAt` / `nameOf` / `urlOf` (the runtime reads the wire in place).
import { escapeJSON } from "./resume-format.ts";
import type { BoundaryRecord, BoundaryTail, FlushTail, TailEntry, TailName } from "./resume-format.ts";

/** Longest run period tried (calendar grids interleave two names; list rows up to four nested boundaries). */
const PERIOD = 4;

const stateless = (r: BoundaryRecord): boolean => r[4].length === 0 && r.length < 6;

/**
 * A chunk URL as the tail / `data-fo` write it: with `base` (the runtime's directory, `data-ab`) a same-directory `.js`
 * URL drops both (`/assets/page-BIloCagF.js` → `page-BIloCagF`); anything else stays whole (it holds a `/`).
 */
export function shortUrl(url: string, base: string | undefined): string {
  if (!base || !url.startsWith(base) || !url.endsWith(".js")) return url;
  const short = url.slice(base.length, -3);
  return short.includes("/") || short === "" ? url : short;
}

/** The `data-fo` attribute value (unescaped) of fetch-ahead URLs, in the short form of `shortUrl`. */
export function foAttr(urls: Iterable<string>, base?: string): string {
  let out = "";
  for (const url of urls) out += (out ? " " : "") + shortUrl(url, base);
  return out;
}

/** The base directory of the page's chunks (`data-ab`): the runtime URL's directory when it has one. */
export function chunkBase(runtime: string | undefined): string | undefined {
  const at = runtime ? runtime.lastIndexOf("/") : -1;
  return at > 0 || (at === 0 && runtime!.length > 1) ? runtime!.slice(0, at + 1) : undefined;
}

/**
 * The longest run starting at `i`: `[period, repetitions]` (period 1–4, ≥ 2 repetitions, ≥ 3 records), else null. Per
 * template slot two bits track whether its parent stayed absolute / relative over the repetitions so far (`abs` / `rel`
 * masks, bit `s` = slot `s`); the last pair is written to `modes`.
 */
function runAt(rs: BoundaryRecord[], i: number, len: number, modes: number[]): [period: number, reps: number] | null {
  const first = rs[i]!,
    id0 = first[0];
  for (let p = 1; p <= PERIOD && i + 2 * p <= len; p++) {
    // Slots: consecutive ids, stateless; the first repetition's slot 0 must already match (cheap reject).
    const q0 = rs[i + p]!;
    if (q0[0] !== id0 + p || q0[3] !== first[3] || q0[2] !== first[2] || !stateless(q0)) continue;
    let ok = true;
    for (let s = 1; s < p && ok; s++) ok = rs[i + s]![0] === id0 + s && stateless(rs[i + s]!);
    if (!ok) continue;
    const full = (1 << p) - 1;
    let abs = full,
      rel = full,
      reps = 1;
    for (; i + (reps + 1) * p <= len; reps++) {
      let a = abs,
        r = rel;
      const at = i + reps * p;
      for (let s = 0; s < p; s++) {
        const head = rs[i + s]!,
          q = rs[at + s]!,
          bit = 1 << s;
        if (q[0] !== id0 + reps * p + s || q[3] !== head[3] || q[2] !== head[2] || !stateless(q)) {
          a = -1;
          break;
        }
        if (q[1] !== head[1]) a &= ~bit;
        if (q[1] - q[0] !== head[1] - head[0]) r &= ~bit;
        if (!((a | r) & bit)) {
          a = -1;
          break;
        }
      }
      if (a < 0) break;
      ((abs = a), (rel = r));
    }
    // A shorter period already covering ≥ 3 records wins (a longer one would only re-cover the same records).
    if (reps >= 2 && reps * p >= 3) {
      modes[0] = abs;
      return [p, reps];
    }
  }
  return null;
}

/**
 * Encode a flush as the v2 wire tail (object form; `encodeTail` = its escaped JSON). The flush's records are reused in
 * place (their name becomes its index, an empty value list is dropped): a flush is encoded once.
 */
export function tailOf(t: FlushTail, base?: string): BoundaryTail {
  const names = new Map<string, number>(),
    n: TailName[] = [],
    m = t.m,
    e = t.e;
  let urls: Map<string, number> | undefined,
    u: string[] | undefined,
    // Siblings repeat a name: the previous lookup answers most of them.
    lastName = "",
    lastIdx = -1;
  const nameIdx = (name: string): number => {
    if (name === lastName) return lastIdx;
    let i = names.get(name);
    lastName = name;
    if (i !== undefined) return (lastIdx = i);
    lastIdx = n.length;
    names.set(name, (i = n.length));
    const url = m?.[name];
    let ui = -1;
    if (url !== undefined) {
      const short = shortUrl(url, base);
      ui = (urls ??= new Map()).get(short) ?? -1;
      if (ui < 0) (urls.set(short, (ui = (u ??= []).length)), u.push(short));
    }
    const entry: TailName = [name, ui];
    const types = e?.[name],
      read = t.r?.[name];
    if (types || read) entry.push(types ?? "");
    if (read) entry.push(read);
    n.push(entry);
    return i;
  };
  const rs = t.b,
    len = rs.length,
    b: TailEntry[] = [],
    modes = [0];
  for (let i = 0; i < len;) {
    const r = rs[i]!;
    const run = i + 2 < len && stateless(r) ? runAt(rs, i, len, modes) : null;
    if (run) {
      const [period, reps] = run,
        tmpl: [number, number, number][] = [];
      for (let s = 0; s < period; s++) {
        const head = rs[i + s]!;
        tmpl.push([modes[0]! & (1 << s) ? head[1] : head[1] - head[0], head[2], nameIdx(head[3])]);
      }
      b.push([r[0], 0, 0, -1, reps, tmpl]);
      i += period * reps;
      continue;
    }
    const entry = r as unknown as TailEntry;
    entry[3] = nameIdx(r[3]);
    if (r.length < 6 && r[4].length === 0) (r as unknown[]).length = 4;
    b.push(entry);
    i++;
  }
  const out: BoundaryTail = { v: 2, n, b };
  if (u) out.u = u;
  if (t.w) out.w = t.w;
  if (t.i) out.i = t.i;
  if (t.k) out.k = t.k;
  if (t.g) out.g = t.g;
  if (t.a) out.a = t.a;
  if (t.c) out.c = t.c;
  if (t.d) out.d = t.d;
  return out;
}

/** The v2 tail of a flush as script-safe JSON (`<script type="rivet/boundaries">` text). */
export function encodeTail(t: FlushTail, base?: string): string {
  return escapeJSON(JSON.stringify(tailOf(t, base)));
}
/** Ownership interface name (`ownership.md` §3.4): the tail JSON. */
export const tailJson = encodeTail;
