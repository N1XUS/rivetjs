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
  /** Swaps started; a mount that resolves under an older number is superseded. */
  swaps?: number;
  /** A swap's mount is pending: `handle` was already unmounted. */
  pending?: boolean;
}

/**
 * Re-mount through an async adapter (r3-races#9): the old handle is unmounted once, and a mount a later swap or a
 * disposal superseded is unmounted when it resolves instead of staying mounted and leaked.
 */
export function swapIsland(island: DevIsland, mount: () => unknown, commit: (next: unknown) => void): void {
  const mine = (island.swaps = (island.swaps ?? 0) + 1);
  if (!island.pending) island.adapter.unmount(island.handle);
  island.pending = true;
  island.root.replaceChildren();
  void Promise.resolve(mount()).then((next) => {
    if (mine !== island.swaps) return void island.adapter.unmount(next);
    island.pending = false;
    commit(next);
  });
}

/** The final unmount of a parked island nobody claimed: a pending swap's mount unmounts itself when it resolves. */
export function retireIsland(island: DevIsland): void {
  if (!island.pending) return void island.adapter.unmount(island.handle);
  island.swaps = (island.swaps ?? 0) + 1;
  island.pending = false;
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
