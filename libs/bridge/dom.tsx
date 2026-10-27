// @rivetjs/bridge/dom — `_island` in the browser: islands created on the client (a `Show` branch first rendered in the
// browser, a client navigation, a client-rendered app). No server HTML: the root holds the `fallback` until the
// `client` policy fires, then the adapter mounts into it (spec §3.4 "Client-created islands"). Slot content renders
// here into owned outputs and reaches the adapter as `Node[]` (its `Slot` appends them into the hole; spec §3.8).
import { _dom, type DOMValue } from "@rivetjs/runtime/dom";
import { isSlot } from "@rivetjs/runtime/slot";
import { splitProps } from "@rivetjs/runtime/props";
import { untrack } from "@rivetjs/reactivity";
import { DEV } from "#dev";
import { _drive } from "./client.ts";
import { trigger } from "./triggers.ts";
import { claim } from "./hot.ts";
import type { ClientOn, ClientPolicy, IslandDef, IslandModule, PolicyOptions } from "./adapter.ts";

export type { IslandDef } from "./adapter.ts";

const OWN = ["client", "preload", "persist", "fallback"] as const;
/** Rivet content in the browser: nodes (compiled JSX), `_slot` thunks, arrays of them. */
const isContent = (value: unknown): boolean => value instanceof Node || isSlot(value) || (Array.isArray(value) && value.length > 0 && value.every(isContent));
let n = 0;

/**
 * @internal Facade ABI (DOM variant of `@rivetjs/bridge/server` `_island`): a client-created island. `def.id` names
 * it in dev attributes; `load` = the facade's loader (the island chunk). Without a loader the island renders its
 * fallback only (dev warning).
 */
export function _island(props: Record<string, unknown>, def: IslandDef, load?: () => Promise<IslandModule>): DOMValue {
  // Derived model (M6-PARITY): inside an adopt run the island is a hole over its server root; the runtime calls `adopt`
  // after the run for the islands its record names (tail `i`: not booted by the lean boot).
  const hook = (globalThis as { [ISLAND]?: IslandHook })[ISLAND];
  const held = hook?.((root, swap) => untrack(() => adopt(props, root, load, swap)));
  if (held !== undefined) return held as DOMValue;
  // Untracked (as on the server): the facade's `{_island(…)}` child never re-runs; live props flow through the driver.
  return untrack(() => create(props, def, load));
}

/** The derived runtime's island hook (`dom-derived.ts`, installed at start): a hole in an adopt run, else undefined. */
type IslandHook = (adopt: (root: Element, swap?: Retarget) => void) => unknown;
/** The runtime's `retarget` (`dom-derived.ts`): `swap()` replaces `old`; held events on `old` replay on the fresh nodes. */
type Retarget = (old: Node[], swap: () => Node[]) => void;
const ISLAND = Symbol.for("rivet.island");

/** A server-rendered island the derived adopt run hydrates: the driver over its root, the policy applied here. */
function adopt(props: Record<string, unknown>, root: Element, load?: () => Promise<IslandModule>, swap?: Retarget): void {
  if (load === undefined) return;
  const [own, rest] = splitProps(props, OWN) as unknown as [{ client?: ClientPolicy }, Record<string, unknown>];
  const client = own.client;
  const on: ClientOn | undefined = typeof client === "string" ? client : client?.on;
  let slotKeys: string[] | null = null;
  for (const key of Object.keys(rest)) if (key === "children" || isContent(rest[key])) (slotKeys ??= []).push(key);
  const live = slotKeys === null ? rest : (splitProps(rest, slotKeys) as unknown as Record<string, unknown>[])[1]!;
  // Slot content: rendered here again (Rivet-owned outputs under the unit's owner) into the server's `rivet-slot` holes
  // of this island, before the framework hydrates over them; its handlers work from the adopt run on. A cold event held
  // on the server nodes (a click before the chunks loaded) replays on the new ones (`swap`: the runtime's retarget, E3).
  if (slotKeys !== null) {
    const doc = root.ownerDocument;
    for (const hole of root.querySelectorAll("rivet-slot")) {
      if (hole.closest("rivet-island") !== root) continue;
      const name = hole.getAttribute("name") ?? "default";
      const value = rest[name === "default" ? "children" : name];
      const fill = (): Node[] => {
        const fresh = value == null ? [] : _dom.nodes(_dom.output(doc, () => value));
        hole.replaceChildren(...fresh);
        return fresh;
      };
      if (swap) swap([...hole.childNodes], fill);
      else fill();
    }
  }
  const id = root.getAttribute("data-ri")!;
  const options: PolicyOptions = typeof client === "object" ? { ...client, id } : on !== undefined ? { id, on } : { id };
  // `only`: mounts over the server fallback; no policy: hydrates on the first prop change (as a resumed island).
  _drive(load, root, live, options, on === "only" ? "mount" : "hydrate", {}, undefined, on === undefined || on === "intent" ? undefined : trigger);
}

function create(props: Record<string, unknown>, def: IslandDef, load?: () => Promise<IslandModule>): DOMValue {
  const [own, rest] = splitProps(props, OWN) as unknown as [{ client?: ClientPolicy; fallback?: DOMValue }, Record<string, unknown>];
  const client = own.client;
  const on: ClientOn | undefined = typeof client === "string" ? client : client?.on;
  // Dev: a Rivet hot update re-rendering the facade takes over the island it disposed (`hot.ts`: DOM + framework state kept).
  const kept = DEV && load !== undefined ? claim(def.id) : undefined;
  const id = kept ? kept.root.getAttribute("data-ri")! : "c" + n++;
  const root = kept ? kept.root : ((<rivet-island data-ri={id} data-rc={DEV ? on : undefined} style={{ display: "contents" }} />) as unknown as Element);
  const doc = root.ownerDocument;
  // Slots: `children` → "default", content props by key; rendered once (Rivet-owned outputs, disposed with the island).
  const slots: Record<string, Node[] | null> = {};
  let slotKeys: string[] | null = null;
  for (const key of Object.keys(rest)) {
    const value = rest[key];
    if (key !== "children" && !isContent(value)) continue;
    (slotKeys ??= []).push(key);
    slots[key === "children" ? "default" : key] = value == null ? null : _dom.nodes(_dom.output(doc, () => value));
  }
  const live = slotKeys === null ? rest : (splitProps(rest, slotKeys) as unknown as Record<string, unknown>[])[1]!;
  // The fallback stands in until the adapter mounts (it also gives `visible` a box to observe).
  const fallback = own.fallback;
  let shown: ReturnType<typeof _dom.output> | undefined;
  if (kept) {
    // The kept island's holes get this render's slot content (the old one was disposed with its owner).
    for (const hole of root.querySelectorAll("rivet-slot"))
      if (hole.closest("rivet-island") === root) hole.replaceChildren(...(slots[hole.getAttribute("name") ?? "default"] ?? []));
  } else if (fallback != null) root.append(..._dom.nodes((shown = _dom.output(doc, () => fallback))));
  if (load === undefined) {
    if (DEV) console.warn("[rivet:bridge] island " + def.id + " has no loader: it renders its fallback only");
    return root as unknown as DOMValue;
  }
  const options: PolicyOptions = typeof client === "object" ? { ...client, id } : on !== undefined ? { id, on } : { id };
  _drive(load, root, live, options, "mount", slots, shown && (() => shown!.dispose()), trigger, kept);
  return root as unknown as DOMValue;
}
