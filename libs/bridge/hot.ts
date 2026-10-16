// Development-only island HMR (spec §4.4, T5 rulings). Imported by the driver / DOM `_island` inside `if (DEV)`
// branches only (no top-level side effects: production bundles drop the module).
// - A framework module edit its own HMR does not take reaches the generated island module's `import.meta.hot.accept`
//   (`facade.ts` `islandModule`) → `__rivetBridgeDev.replace(key, component)`: every mounted island of that key
//   re-mounts with the new component (its slots kept); other islands and the Rivet page are untouched.
// - A Rivet module edit re-renders the Rivet component holding an island: its owner is disposed and the facade runs
//   again. The disposed island is parked (root element + framework handle) for one task; the facade's next `_island` of
//   the same key claims it (same DOM, framework state kept, new props / slot content). Unclaimed: unmounted.
import type { ClientAdapter } from "./adapter.ts";
import type { Slots } from "./client.ts";

/** A mounted island the dev runtime can re-mount (`swap`) or hand over to a new owner (`park` / `claim`). */
export interface DevIsland {
  key: string;
  root: Element;
  adapter: ClientAdapter;
  handle: unknown;
  /** Re-mount with a new component (same root, props and slot nodes). */
  swap(component: unknown): void;
}

const live = new Map<string, Set<DevIsland>>();
const parked = new Map<string, DevIsland[]>();

/** Register a mounted island for `replace`; returns the remover. */
export function track(island: DevIsland): () => void {
  (globalThis as { __rivetBridgeDev?: unknown }).__rivetBridgeDev ??= {
    replace(key: string, component: unknown) {
      for (const entry of [...(live.get(key) ?? [])]) entry.swap(component);
    },
  };
  let set = live.get(island.key);
  if (!set) live.set(island.key, (set = new Set()));
  set.add(island);
  return () => set!.delete(island);
}

/** Park a disposed island for one task; `unmount` runs when no new `_island` of its key claimed it by then. */
export function park(island: DevIsland, unmount: () => void): void {
  let list = parked.get(island.key);
  if (!list) parked.set(island.key, (list = []));
  list.push(island);
  setTimeout(() => {
    const at = list!.indexOf(island);
    if (at < 0) return;
    list!.splice(at, 1);
    unmount();
  });
}

/** The oldest parked island of a key (taken), else undefined. */
export function claim(key: string): DevIsland | undefined {
  return parked.get(key)?.shift();
}
