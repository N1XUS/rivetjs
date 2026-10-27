// Lean islands (T7b, spec §3.12; derived model since M6-PARITY): a hydrated island whose framework props are plain JSON
// boots without the Rivet runtime — `server.tsx` `_island` offers it to the derived recorder (`_rIsland`), which writes
// the island records (`<script type="rivet/islands">`) + the inline lean boot (`boot.ts`, which modulepreloads the
// island chunks at idle after the first paint entry) before the boundaries tail (`derivedLean`). Anything else (live /
// callback / slot / non-JSON props, no policy) hydrates from the adopt run of the boundary rendering it.
import { _trackReads } from "@rivetjs/reactivity/track";
import { BOOT } from "./boot.min.ts";
import type { LeanRecord } from "./boot.ts";

// `visible`: fetched near the viewport, not at idle (the boot's near observer reads the same closure).
const PREFETCH = new Set(["idle", "visible", "load", "only"]);

// Inside a `<script>`: no `</script`, `<!--` or line separators survive (`<` and U+2028/9 escaped).
const json = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

/** A plain JSON value (what `JSON.parse(JSON.stringify(v))` returns unchanged): the lean boot passes props as JSON. */
function plain(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || depth > 64) return false;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!(i in value) || !plain(value[i], depth + 1)) return false;
    return true;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (descriptor.get || !plain(descriptor.value, depth + 1)) return false;
  }
  return Object.getOwnPropertySymbols(value).length === 0;
}

/**
 * @internal A hydrated island's framework props as plain JSON values (what the lean boot passes), or why it needs the full
 * driver: `blocked` (slots, `intent`), no policy (hydrate on change), a live getter (reads a signal), a function, a value
 * that is not plain JSON.
 */
export function leanValues(on: string | undefined, props: Record<string, unknown>, blocked: string | null): Record<string, unknown> | string {
  if (blocked === null && on === undefined) blocked = "live props without a client policy (hydrate on change)";
  if (blocked !== null) return blocked;
  const values: Record<string, unknown> = {};
  for (const name of Object.keys(props)) {
    const descriptor = Object.getOwnPropertyDescriptor(props, name)!;
    let value = descriptor.value;
    if (descriptor.get) {
      // A getter prop is live only when it reads a signal: a computed constant (`rows.map(…)`, `t("x")`,
      // `fmt(n)`) is the compiler's `_rProps` getter over plain values, sent as its value.
      const read = _trackReads(descriptor.get.bind(props));
      if (read.signals.length) return 'prop "' + name + '" is live (reads a signal)';
      value = read.value;
    }
    if (typeof value === "function") return 'prop "' + name + '" is a function (callback)';
    if (value !== undefined && !plain(value)) return 'prop "' + name + '" is not a plain JSON value';
    if (value !== undefined) values[name] = value;
  }
  return values;
}

/**
 * @internal The lean islands of a derived render's shell (runtime `_rIsland`, M6-PARITY) — their records +
 * the lean boot, written before the boundaries tail (no Rivet runtime for them). An island without a chunk in the
 * manifest is left out (it stays static, as on a lean page).
 */
export function derivedLean(
  islands: readonly { id: string; key: string; on: string | undefined; props: Record<string, unknown> | null }[],
  manifest: { islands?: Record<string, string>; deps?: Record<string, string[]> } | undefined,
  nonce: string,
): string {
  const records: LeanRecord[] = [];
  for (const island of islands) {
    const url = manifest?.islands?.[island.key];
    // `props` null: an island its boundary's adopt run hydrates; a `visible` one gets a prefetch-only record (the boot
    // fetches its closure near the viewport, user ruling 2026-10-27).
    if (url === undefined || (island.props === null && island.on !== "visible") || island.on === undefined) continue;
    records.push(
      PREFETCH.has(island.on) ? [island.id, url, island.props, island.on, [url, ...(manifest?.deps?.[url] ?? [])]] : [island.id, url, island.props, island.on],
    );
  }
  if (!records.length) return "";
  const attr = nonce ? ' nonce="' + nonce + '"' : "";
  return '<script type="rivet/islands"' + attr + ">" + json(records) + "</script><script" + attr + ">" + BOOT + "</script>";
}
