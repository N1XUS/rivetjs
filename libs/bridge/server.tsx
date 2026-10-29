// @rivetjs/bridge/server — `_island` on the server: one framework island in the Rivet stream (spec §3.3–§3.5, §3.9).
// The facade calls `_island(props, ISLAND, load)` per foreign component export; the adapter renders the framework
// HTML with slot holes, the core writes it as trusted markup around the Rivet slot content (in place, resumable), and
// records the hydration effect only when a `client` policy is set (or a live prop needs hydrate-on-change).
import { Async, type ServerValue } from "@rivetjs/runtime/server";
import type { ClientWhen } from "@rivetjs/runtime/server";
import { _markup } from "@rivetjs/runtime/server-markup";
import { _renderNonce } from "@rivetjs/runtime/server-resume";
import { isSlot } from "@rivetjs/runtime/slot";
import { splitProps } from "@rivetjs/runtime/props";
import { untrack } from "@rivetjs/reactivity";
import { DEV, devWhere } from "#dev";
import { _hydratedRoot, _staticRoot } from "./root.tsx";
import { _renderIslands } from "./ids.ts";
import { derivedLean, leanValues } from "./lean.ts";
import { _rIsland } from "@rivetjs/runtime/derived-eager";
import { slotMark, splitSlots } from "./slots.ts";
import type { ClientOn, ClientPolicy, IslandContext, IslandDef, IslandModule, IslandRender, PolicyOptions, PreloadStrategy, SlotMark } from "./adapter.ts";

export type { IslandDef } from "./adapter.ts";

// Island-level props: read once by the core, never passed to the framework (`client`, `persist` (reserved, no effect yet): not live, documented).
const OWN = ["client", "preload", "persist", "fallback"] as const;
const TEMPLATE = Symbol.for("rivet.template"),
  COMPILED = Symbol.for("rivet.compiled");

/** Rivet content (a slot): compiled JSX (template records), `_slot` thunks, arrays of them. */
const isContent = (value: unknown): boolean =>
  isSlot(value) ||
  (value !== null &&
    typeof value === "object" &&
    (TEMPLATE in value || COMPILED in value || (Array.isArray(value) && value.length > 0 && value.every(isContent))));

// Policy → hydration trigger (spec §3.5 table; the derived model fetches island chunks ahead, `preload` has no effect).
const WHEN: Record<string, ClientWhen> = { load: "load", idle: "idle", visible: "visible", interaction: "interaction", intent: "idle", only: "load" };
const whenOf = (on: ClientOn): ClientWhen => (on.startsWith("media:") ? (on as ClientWhen) : WHEN[on]!);

const failure = (fw: string, id: string, cause: unknown, where: string): Error =>
  new Error("[rivet:bridge] RV2144 " + fw + " island " + id + " failed to render: " + (cause instanceof Error ? cause.message : String(cause)) + where, {
    cause,
  });

/**
 * @internal Facade ABI: render one island. `props` = the facade's live props object; `def` = the module-level island
 * declaration (server variant: component `c` + adapter `a`); `load` = the facade's inline loader arrow (resumable:
 * `_rFn` / `_rMod`; a module-level object member would not be), captured by the hydration effect.
 */
export function _island(props: Record<string, unknown>, def: IslandDef, load?: () => Promise<IslandModule>): ServerValue {
  // Untracked: the facade's `{_island(…)}` child must not record a binding over the props it reads here (a resumed
  // page would re-create the island on the first change); live props reach the browser through the hydration effect.
  return untrack(() => render(props, def, load));
}

function render(props: Record<string, unknown>, def: IslandDef, load?: () => Promise<IslandModule>): ServerValue {
  const adapter = def.a!;
  const [own, rest] = splitProps(props, OWN) as unknown as [
    { client?: ClientPolicy; preload?: PreloadStrategy; persist?: string; fallback?: unknown },
    Record<string, unknown>,
  ];
  const client = own.client,
    fallback = own.fallback;
  // Framework props (values) vs slots (Rivet content: `children` → "default", content props by key).
  const values: Record<string, unknown> = {},
    content: Record<string, unknown> = {},
    marks: Record<string, SlotMark> = {};
  let slotKeys: string[] | null = null;
  for (const key of Object.keys(rest)) {
    const value = rest[key];
    if (key === "children" || isContent(value)) {
      if (value == null) continue;
      const name = key === "children" ? "default" : key;
      content[name] = value;
      marks[name] = slotMark(name);
      (slotKeys ??= []).push(key);
    } else values[key] = value;
  }
  const islands = _renderIslands();
  const id = "i" + islands.n++;
  const on: ClientOn | undefined = typeof client === "string" ? client : client?.on;
  const fw = adapter.name;
  const rf = DEV ? fw : undefined,
    rc = DEV ? on : undefined;
  // `ctx.signal`: created on first read, linked to the Async boundary's request signal (only async renders have one).
  let controller: AbortController | undefined, work: { readonly signal: AbortSignal } | undefined;
  const link = () => {
    if (!work) return;
    const request = work.signal;
    if (request.aborted) controller!.abort(request.reason);
    else request.addEventListener("abort", () => controller!.abort(request.reason), { once: true });
  };
  const ctx: IslandContext = {
    id,
    nonce: _renderNonce(),
    get signal() {
      if (!controller) ((controller = new AbortController()), link());
      return controller.signal;
    },
    slot: (name) => marks[name] ?? slotMark(name),
  };
  // The live part the browser hydrates with: framework props only (forwarding getters, never read here).
  const live = (): Record<string, unknown> => (slotKeys === null ? rest : (splitProps(rest, slotKeys) as unknown as Record<string, unknown>[])[1]!);
  const tracked = (): boolean => {
    for (const key in values) if (Object.getOwnPropertyDescriptor(rest, key)?.get) return true;
    return false;
  };
  const root = (parts: unknown): ServerValue => {
    if (on !== undefined || (load !== undefined && tracked())) {
      if (load === undefined) {
        if (DEV) console.warn("[rivet:bridge] " + fw + " island " + def.id + ' has client="' + on + '" but no loader: it stays static' + devWhere());
        return _staticRoot(id, rf, rc, parts) as ServerValue;
      }
      const options: PolicyOptions = typeof client === "object" ? { ...client, id } : on !== undefined ? { id, on } : { id };
      const props = live();
      const blocked =
        slotKeys !== null
          ? 'slot "' + (slotKeys[0] === "children" ? "default" : slotKeys[0]) + '" holds Rivet content'
          : on === "intent"
            ? 'client="intent" (cold-event replay)'
            : null;
      let answer: Record<string, unknown> | string | undefined;
      const values = () => (answer ??= leanValues(on, props, blocked));
      // Plain JSON props → the lean boot; else the adopt run of the boundary rendering it (M6-PARITY).
      _rIsland({ id, key: def.id, on, values, props: null, tail: derivedLean });
      return _hydratedRoot(id, rf, rc, parts, load, props, options, on !== undefined ? whenOf(on) : "idle") as ServerValue;
    }
    return _staticRoot(id, rf, rc, parts) as ServerValue;
  };
  const failed = (cause: unknown, where: string): ServerValue => {
    if (fallback !== undefined) return _staticRoot(id, rf, rc, fallback) as ServerValue;
    throw failure(fw, def.id, cause, where);
  };
  const written = (out: string | IslandRender): ServerValue => {
    const html = typeof out === "string" ? out : out.html;
    const head = typeof out === "string" ? undefined : out.head;
    const { parts, order } = splitSlots(html, Object.values(marks));
    const used = new Set<string>();
    const out_: ServerValue[] = [_markup(parts[0]!)];
    // A hole missing or written twice (a framework that rewrote the mark) is a render failure in every build: the
    // island error path (fallback, else RV2144), never silently dropped or duplicated slot content.
    let broken: string | undefined;
    for (let i = 0; i < order.length; i++) {
      const name = order[i]!;
      if (used.has(name)) {
        broken = 'slot "' + name + '" has more than one hole';
        break;
      }
      used.add(name);
      out_.push(content[name] as ServerValue, _markup(parts[i + 1]!));
    }
    if (broken === undefined) for (const name in marks) if (!used.has(name)) broken = 'slot "' + name + '" has no hole in the rendered HTML';
    if (broken !== undefined) return failed(new Error(broken), DEV ? devWhere() : "");
    let hoisted: ServerValue = null;
    if (head !== undefined) {
      if (def.head) hoisted = def.head(head);
      else if (DEV) console.warn("[rivet:bridge] " + fw + " island " + def.id + ": head entries dropped (no head sink: use @rivetjs/kit)");
    }
    return hoisted === null ? root(out_) : [hoisted, root(out_)];
  };
  // `client="only"`: no server render, so no adapter head either; the fallback (Rivet content) stands in until the
  // browser mounts.
  if (on === "only") return root(fallback ?? null);
  // Page-level adapter head (Solid `_$HY`): once per render (per id scope), before its first server-rendered island.
  let pageHead: ServerValue = null;
  if (adapter.head && !islands.heads?.has(fw)) {
    islands.heads?.add(fw);
    pageHead = _markup(adapter.head(ctx));
  }
  const withHead = (value: ServerValue): ServerValue => (pageHead === null ? value : [pageHead, value]);
  let out: string | IslandRender | PromiseLike<string | IslandRender>;
  try {
    out = adapter.render(def.c, values, marks, ctx);
  } catch (cause) {
    return withHead(failed(cause, DEV ? devWhere() : ""));
  }
  if (typeof out === "string" || typeof (out as PromiseLike<unknown>).then !== "function") return withHead(written(out as string | IslandRender));
  // Async render: an Async boundary (awaited in ordered renders; a streaming Suspense above streams it as a segment,
  // whose patch then carries the island's records). Request abort reaches the adapter through `ctx.signal`.
  const where = DEV ? devWhere() : "";
  const pending = out as PromiseLike<string | IslandRender>;
  return withHead(
    Async({
      load: (boundary) => {
        work = boundary;
        if (controller) link();
        return pending;
      },
      children: written,
      error: (cause) => failed(cause, where),
      // The runtime's own (`server-async.ts`): never a derived hole.
      ...({ $i: 1 } as object),
    }) as ServerValue,
  );
}
