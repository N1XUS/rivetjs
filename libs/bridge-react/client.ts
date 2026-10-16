// @rivetjs/bridge-react/client — React 19 client adapter (spec §3.4): `hydrateRoot` inside `startTransition` (the
// island's hydration never blocks the page; same `identifierPrefix` as the server), `createRoot` for client-created
// islands, `root.render` for prop updates (default priority inside a user event, a transition otherwise), `unmount`.
import { startTransition, type ComponentType } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { islandRecovered, type ClientAdapter } from "@rivetjs/bridge/adapter";
import { islandElement } from "./tree.ts";
import { withSlots } from "./slot.ts";

type Component = ComponentType<Record<string, unknown>>;
interface Handle {
  root: Root;
  component: Component;
  names: string[];
  slots: Record<string, Node[] | null>;
}

/** The client's head mark: nothing (the server's sentinel is not in the DOM). */
const Mark = () => null;

const element = (handle: Pick<Handle, "component" | "names" | "slots">, props: Record<string, unknown>) =>
  islandElement(Mark, handle.component, withSlots(props, handle.names, handle.slots));

/** A recoverable React error (hydration mismatch → client render of that subtree): RV2149 with the island id. */
const recoverable = (id: string, root: Element) => (error: unknown) => islandRecovered("react", id, error, root);

/** In a user event (`window.event`): updates render at default priority (the user sees them now). */
const inEvent = () => typeof window !== "undefined" && window.event !== undefined;

export const adapter: ClientAdapter<Component, Handle> = {
  hydrate(root, component, props, slots, ctx) {
    const handle = { component, names: Object.keys(slots), slots } as Handle;
    startTransition(() => {
      handle.root = hydrateRoot(root, element(handle, props), { identifierPrefix: ctx.id + "-", onRecoverableError: recoverable(ctx.id, root) });
    });
    return handle;
  },
  mount(root, component, props, slots, ctx) {
    const handle: Handle = {
      component,
      names: Object.keys(slots),
      slots,
      root: createRoot(root, { identifierPrefix: ctx.id + "-", onRecoverableError: recoverable(ctx.id, root) }),
    };
    handle.root.render(element(handle, props));
    return handle;
  },
  update(handle, props) {
    const next = element(handle, props);
    if (inEvent()) handle.root.render(next);
    else startTransition(() => handle.root.render(next));
  },
  unmount(handle) {
    handle.root.unmount();
  },
};
