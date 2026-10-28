// @rivetjs/bridge/client — the island driver (spec §3.5–§3.8). Loaded lazily: by a resumed island's hydration effect
// (`root.tsx`, `hydrateIsland`) once its policy fires, and by client-created islands (`dom.tsx`, `_drive` + `triggers.ts`).
// One driver per island: load the island chunk, hydrate (or mount) through the chunk's adapter, keep the framework
// props live (one `update` per Rivet batch), wrap function props (`callbacks.ts`), unmount with the owner.
import { effect, getOwner, onCleanup, runWithOwner, untrack } from "@rivetjs/reactivity";
import { DEV } from "#dev";
import { callbacks } from "./callbacks.ts";
import { park, track, type DevIsland } from "./hot.ts";
import type { ClientAdapter, IslandModule, PolicyOptions } from "./adapter.ts";

export type { IslandModule } from "./adapter.ts";

export type Slots = Record<string, Node[] | null>;
export type Mode = "hydrate" | "mount";
export type Listen = (target: EventTarget, type: string, fn: (event: Event) => void, capture?: boolean) => void;

/** Island roots whose hydrate / mount is in flight: an outer island waits for the inner ones (spec §3.8 nesting). */
const pending = new WeakMap<Element, Promise<unknown>>();
/** The presses an `intent` island records before it hydrates (`intent.ts` records the same). */
const PRESS = ["pointerdown", "click"];

/** The resumed Rivet content in each slot hole of `root` (holes of nested islands excluded), by slot name. */
export function slotNodes(root: Element): Slots {
  const slots: Slots = {};
  for (const hole of root.querySelectorAll("rivet-slot"))
    if (hole.closest("rivet-island") === root) slots[hole.getAttribute("name") ?? "default"] = [...hole.childNodes];
  return slots;
}

/**
 * @internal Resume ABI (`root.tsx` hydration effect, run with the island's owner): hydrate a server-rendered island.
 * The resume runtime already applied the policy trigger (`when`), except `intent` (island-local listeners, `intent.ts`) and
 * `only` (mounts over the server `fallback`). No `options.on` = static island with live props: hydrate on the first
 * prop change with the old values, then update.
 */
export function hydrateIsland(load: () => Promise<IslandModule>, root: Element, props: Record<string, unknown>, options: PolicyOptions): void {
  _drive(load, root, props, options, options.on === "only" ? "mount" : "hydrate", {});
}

/** @internal Policy trigger of a client-created island (`triggers.ts`; the resume runtime applies it for resumed ones). */
export type Trigger = (
  on: string,
  root: Element,
  options: PolicyOptions,
  listen: Listen,
  stops: (() => void)[],
  start: () => void,
  /** Fetch the island chunk without hydrating (`visible`: once the island nears the viewport). */
  fetch?: () => void,
) => void;

/**
 * @internal The driver of one island (run with the island's owner). `mode` "mount" with a `trigger` = client-created
 * (`dom.tsx`: the policy fires here, `given` = Rivet-rendered slot nodes, `clear` disposes the fallback). Dev: `kept` =
 * a parked island of the same key (`hot.ts`) this driver takes over (mounted already: props update, no load).
 */
export function _drive(
  load: () => Promise<IslandModule>,
  root: Element,
  props: Record<string, unknown>,
  options: PolicyOptions,
  mode: Mode,
  given: Slots,
  clear?: () => void,
  trigger?: Trigger,
  kept?: DevIsland,
): void {
  const owner = getOwner();
  const table = callbacks(owner);
  const on = options.on;
  let dead = false,
    started = false,
    adapter: ClientAdapter | undefined,
    handle: unknown,
    ready = false,
    base: Record<string, unknown> | undefined,
    latest: Record<string, unknown> | undefined;
  // Events that reached the island before it hydrated (intent policy): replayed once after it.
  let replay: Event[] | null = null;
  const stops: (() => void)[] = [];
  let unrecord: (() => void) | undefined;
  let cold: Promise<typeof import("./intent.ts")> | undefined;
  // `intent`: a pointerdown / click before hydration starts the island and is recorded for one replay. Recorded here,
  // synchronously, so a press the resume runtime replays right after this island's adopt run (a cold press before
  // boot: T-INTENT-COLD) is kept before `intent.ts` (hover / focus / touch triggers + the replay, on demand) is in.
  const watch = () => {
    const record = (event: Event) => {
      const list = (replay ??= []);
      if (!list.some((e) => e.type === event.type)) list.push(event);
      start();
    };
    for (const type of PRESS) root.addEventListener(type, record, { capture: true, passive: true });
    unrecord = () => {
      for (const type of PRESS) root.removeEventListener(type, record, { capture: true });
    };
    void (cold = import("./intent.ts")).then((mod) => dead || started || mod.intent(root, listen, start));
  };
  const listen: Listen = (target, type, fn, capture = true) => {
    target.addEventListener(type, fn, { capture, passive: true });
    stops.push(() => target.removeEventListener(type, fn, { capture }));
  };
  const stopListening = () => {
    for (const stop of stops.splice(0)) stop();
  };
  const ctx = { id: options.id };
  // Dev HMR (`hot.ts`): the mounted island, registered for re-mounts and parked on disposal.
  let dev: DevIsland | undefined, untrackDev: (() => void) | undefined;
  const register = (key: string | undefined, slots: Slots) => {
    if (!key) return;
    const island: DevIsland = (dev = {
      key,
      root,
      adapter: adapter!,
      handle,
      swap(component) {
        untrack(() => adapter!.unmount(handle));
        root.replaceChildren();
        void Promise.resolve(untrack(() => adapter!.mount(root, component, latest!, slots, ctx))).then((next) => (handle = island.handle = next));
      },
    });
    untrackDev = track(island);
  };
  if (DEV && kept) {
    adapter = kept.adapter;
    handle = kept.handle;
    started = ready = true;
    register(kept.key, given);
  }

  const start = (): void => {
    if (started || dead) return;
    started = true;
    stopListening();
    const values = base!;
    const done = load().then(
      async (mod) => {
        if (dead) return;
        // Nested islands inside this one hydrate first (their holes are stable through this one's hydration).
        const inner: Promise<unknown>[] = [];
        for (const el of root.querySelectorAll("rivet-island")) {
          const wait = pending.get(el);
          if (wait) inner.push(wait);
        }
        if (inner.length) await Promise.all(inner);
        if (dead) return;
        adapter = mod.adapter;
        const component = mod.default;
        let result: unknown;
        const slots = mode === "hydrate" ? slotNodes(root) : given;
        if (mode === "hydrate") {
          try {
            result = await untrack(() => adapter!.hydrate(root, component, values, slots, ctx));
          } catch (error) {
            // Hydration mismatch / throw: mount fresh over the server HTML, the resumed slot content moved into the new holes.
            if (DEV) console.warn("[rivet:bridge] island " + options.id + " failed to hydrate, mounting instead:", error);
            if (dead) return;
            root.replaceChildren();
            result = await untrack(() => adapter!.mount(root, component, values, slots, ctx));
          }
        } else {
          // Replace the fallback (server-written for `only`, Rivet-owned for client-created islands).
          clear?.();
          root.replaceChildren();
          (root as HTMLElement).style.display = "contents";
          result = await untrack(() => adapter!.mount(root, component, values, slots, ctx));
        }
        if (dead) {
          untrack(() => adapter!.unmount(result));
          return;
        }
        handle = result;
        ready = true;
        if (DEV) register(mod.__rivetIsland, slots);
        if (latest !== values) untrack(() => adapter!.update(handle, latest!));
        unrecord?.();
        if (replay) {
          const events = replay;
          replay = null;
          const { redispatch } = await cold!;
          if (!dead) for (const event of events) redispatch(event);
        }
      },
      (error: unknown) => {
        // Chunk failure: the island stays as rendered (static HTML), reported once.
        console.error("[rivet:bridge] island " + (DEV ? options.id + " " : "") + "chunk failed to load:", error);
      },
    );
    const settled = done.catch((error: unknown) => {
      if (!dead) console.error("[rivet:bridge] island " + (DEV ? options.id + " " : "") + "failed to start:", error);
    });
    pending.set(root, settled);
    void settled.then(() => pending.get(root) === settled && pending.delete(root));
  };

  runWithOwner(owner, () => {
    onCleanup(() => {
      dead = true;
      table.kill();
      stopListening();
      unrecord?.();
      if (ready) {
        ready = false;
        if (DEV && dev) {
          // A Rivet hot update re-renders the owner: the next `_island` of this key may take the island over.
          untrackDev!();
          const island = dev;
          island.handle = handle;
          park(island, () => untrack(() => island.adapter.unmount(island.handle)));
        } else untrack(() => adapter!.unmount(handle));
      }
    });
    // Live props: the first run is the hydration snapshot; later runs (one per Rivet batch) update the framework, or,
    // for a static island with live props, start it (hydrate with the old values, then update).
    effect(() => {
      const next = table.snapshot(props);
      if (base === undefined) {
        base = latest = next;
        if (DEV && kept) untrack(() => adapter!.update(handle, next));
        return;
      }
      latest = next;
      if (ready) untrack(() => adapter!.update(handle, next));
      else if (on === undefined) start();
    });
  });

  if (DEV && kept) return;
  if (trigger === undefined) {
    // Resumed: the runtime applied the trigger (`when`). No policy = static island with live props: wait for a change.
    if (on === "intent") watch();
    else if (on !== undefined) start();
    return;
  }
  // Client-created: the policy trigger runs once the root is in the document (the caller inserts it synchronously).
  queueMicrotask(() => {
    if (dead) return;
    if (on === undefined) start();
    else if (on === "intent") watch();
    else trigger(on, root, options, listen, stops, start, () => void load().catch(() => {}));
  });
}
