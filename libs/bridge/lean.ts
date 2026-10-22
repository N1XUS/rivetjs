// Islands-only lean tail (T7b, spec §3.12): per resumable render, the hydrated islands with plain-value props. At the
// end of the shell (`_rLean` provider) the runtime asks whether the page can boot without the Rivet resume runtime:
// yes when every recorded resumable is a bridge island effect and every island is lean-eligible — then the tail is
// the island records (`<script type="rivet/islands">`) + the inline lean boot (`boot.ts`, which modulepreloads the
// island chunks at idle after the first paint entry), instead of the state script + resume loader. Exact per render, so the same route
// takes either tail depending on its props; anything else keeps the full driver (dev: one log line naming why).
import { _trackReads } from "@rivetjs/reactivity/track";
import { _rLean, type DeferredState, type LeanTail, type LeanView } from "@rivetjs/runtime/server-resume";
import { _markup } from "@rivetjs/runtime/server-markup";
import type { ServerValue } from "@rivetjs/runtime/server";
import { BOOT } from "./boot.min.ts";
import type { LeanRecord } from "./boot.ts";

/** The island hydration effect's symbol (`root.tsx` `_hydratedRoot`), content-hashed: `…/root.tsx#_hydratedRoot$<hash>`. */
const ROOT_EFFECT = /(^|\/)root\.tsx#_hydratedRoot\$/;
const PREFETCH = new Set(["idle", "visible", "load", "only"]);

interface Island {
  id: string;
  key: string;
  props: Record<string, unknown>;
  on: string;
}

class Lean implements LeanTail {
  islands: Island[] = [];
  /** Why this render keeps the full driver (first reason only). */
  blocked: string | null = null;
  /** Dev build of the caller (`server.tsx` `#dev`): log why a page keeps the full driver. */
  dev = false;
  tail(view: LeanView, deferred: DeferredState): ServerValue | null {
    let reason = this.blocked ?? blockers(view, this.islands.length);
    // D-lean: the page's other resumables are only regions + intent client events (a file router's region and its
    // link / popstate listeners): their state + resume loader follow the lean boot, without the islands' effects, and
    // start the runtime on the first link intent / click instead of at load.
    let rest: ServerValue | null = null;
    if (reason === null && (view.regions.length || view.clientEvents.length)) {
      rest = deferred((symbol) => ROOT_EFFECT.test(symbol), new Set(this.islands.map((island) => island.key)));
      if (rest === null)
        reason = "the page has Rivet resumables that boot at load (" + view.regions.length + " region(s), " + view.clientEvents.length + " client event(s))";
    }
    const manifest = view.options.manifest;
    let missing: string | undefined;
    const urls: string[] = [];
    if (reason === null)
      for (const island of this.islands) {
        const url = manifest?.islands?.[island.key];
        if (url === undefined) {
          missing = island.key;
          break;
        }
        urls.push(url);
      }
    if (reason !== null || missing !== undefined) {
      if (this.dev) {
        // Dev servers have no build manifest: the line names what would keep the full driver in a build.
        const why = reason ?? (manifest?.islands ? "island " + missing + " has no chunk in the build manifest" : null);
        if (why !== null && !logged.has(why)) {
          // Bounded: reasons embed ids and counts, a long dev session must not grow the set forever.
          if (logged.size >= 256) logged.clear();
          logged.add(why);
          console.info("[rivet:bridge] full resume driver for this page: " + why);
        }
      }
      return null;
    }
    const nonce = view.options.nonce ? ' nonce="' + String(view.options.nonce).replace(/[^\w+/=-]/g, "") + '"' : "";
    // `idle` / `visible` / `load` / `only`: the chunk + its static imports (the framework vendor), modulepreloaded by the
    // boot at idle after the first paint entry (the full planner's `i` / `P`; `load` chunks were `<link>`s in the HTML until
    // 2026-10-13: high priority during parse, on Lighthouse's simulated paint path). `interaction` / `media:`: none.
    const records: LeanRecord[] = this.islands.map((island, i) =>
      PREFETCH.has(island.on)
        ? [island.id, urls[i]!, island.props, island.on, [urls[i]!, ...(manifest?.deps?.[urls[i]!] ?? [])]]
        : [island.id, urls[i]!, island.props, island.on],
    );
    let html = '<script type="rivet/islands"' + nonce + ">" + json(records) + "</script><script" + nonce + ">" + BOOT + "</script>";
    // The deferred state's loader binds to the state script right before it: after the boot, never between the two.
    const lean = _markup(html) as ServerValue;
    return rest === null ? lean : [lean, rest];
  }
}
const logged = new Set<string>();
const create = () => new Lean();

/** Rivet resumables other than the islands' own hydration effects, regions and client events (`null`: none). */
function blockers(view: LeanView, islands: number): string | null {
  const count = (what: string, n: number) => (n ? n + " " + what : "");
  let effects = 0;
  for (const [symbol] of view.effects) if (ROOT_EFFECT.test(symbol)) effects++;
  let elements = 0;
  for (const element of view.elements) if (element.handlers || element.bindings || element.model || element.spread) elements++;
  const other = [
    count("element(s) with handlers / bindings", elements),
    count("text binding(s)", view.texts.length),
    // Regions + client events: deferred (D-lean, `tail`) unless they boot at load.
    count("client effect(s)", view.effects.length - effects),
    count("streamed boundary(ies)", view.asyncs.length),
    count("error boundary link(s)", view.links.length),
    count("path-addressed row plan(s)", view.paths.length),
  ].filter(Boolean);
  if (other.length) return "the page has Rivet resumables (" + other.join(", ") + ")";
  // Every island effect must be one this collector accepted (a hydrate-on-change island records one too).
  if (effects !== islands) return "island hydration effects (" + effects + ") differ from the lean islands (" + islands + ")";
  return null;
}

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
 * @internal `_island` (server) for a hydrated island: offer it to this render's lean tail. `blocked` = why it needs the
 * full driver (slots, `intent`), else its framework props are checked to be plain JSON values; `dev` = the caller's
 * `#dev` build (log lines). No-op outside a resumable render.
 */
export function offerLean(id: string, key: string, on: string | undefined, props: Record<string, unknown>, blocked: string | null, dev: boolean): void {
  const lean = _rLean(create);
  if (!lean) return;
  lean.dev = dev;
  if (lean.blocked !== null) return;
  if (blocked === null && on === undefined) blocked = "live props without a client policy (hydrate on change)";
  const values: Record<string, unknown> = {};
  if (blocked === null)
    for (const name of Object.keys(props)) {
      const descriptor = Object.getOwnPropertyDescriptor(props, name)!;
      let value = descriptor.value;
      if (descriptor.get) {
        // A getter prop is live only when it reads a signal: a computed constant (`rows.map(…)`, `t("x")`,
        // `fmt(n)`) is the compiler's `_rProps` getter over plain values, sent as its value.
        const read = _trackReads(descriptor.get.bind(props));
        if (read.signals.length) blocked = 'prop "' + name + '" is live (reads a signal)';
        value = read.value;
      }
      if (blocked === null && typeof value === "function") blocked = 'prop "' + name + '" is a function (callback)';
      else if (blocked === null && value !== undefined && !plain(value)) blocked = 'prop "' + name + '" is not a plain JSON value';
      if (blocked !== null) break;
      if (value !== undefined) values[name] = value;
    }
  if (blocked !== null) {
    lean.blocked = "island " + id + " (" + key + "): " + blocked;
    return;
  }
  lean.islands.push({ id, key, props: values, on: on! });
}
