// @rivetjs/bridge-preact/client — Preact client adapter (spec §3.4): `hydrate` over the server HTML (same `useId`
// mask as the server), `render` for client-created islands and prop updates (Preact reconciles in place), `render(null)`
// to unmount. Preact repairs text mismatches in place without reporting them (no RV2149 from this adapter; attributes
// are never patched, see CLAUDE.md); a throw during hydration resets Preact's root (`render(null)`) and takes the
// driver's mount-over path. One `useId` mask per handle (`tree.ts`).
import { hydrate, render, type ComponentType } from "preact";
import type { ClientAdapter } from "@rivetjs/bridge/adapter";
import { islandElement, maskOf, type Mask } from "./tree.ts";
import { withSlots } from "./slot.ts";

type Component = ComponentType<Record<string, unknown>>;
interface Handle {
  root: Element;
  component: Component;
  mask: Mask;
  names: string[];
  slots: Record<string, Node[] | null>;
}

const element = (handle: Handle, props: Record<string, unknown>) => islandElement(handle.component, withSlots(props, handle.names, handle.slots), handle.mask);
const handleOf = (root: Element, component: Component, id: string, slots: Record<string, Node[] | null>): Handle => ({
  root,
  component,
  mask: maskOf(id),
  names: Object.keys(slots),
  slots,
});

export const adapter: ClientAdapter<Component, Handle> = {
  hydrate(root, component, props, slots, ctx) {
    const handle = handleOf(root, component, ctx.id, slots);
    try {
      hydrate(element(handle, props), root);
    } catch (error) {
      // Preact already attached its tree to `root`: reset it so the driver's mount-over starts from a clean root.
      try {
        render(null, root);
      } catch {
        // the failed tree may not unmount cleanly; the driver clears the root next
      }
      throw error;
    }
    return handle;
  },
  mount(root, component, props, slots, ctx) {
    const handle = handleOf(root, component, ctx.id, slots);
    render(element(handle, props), root);
    return handle;
  },
  update(handle, props) {
    render(element(handle, props), handle.root);
  },
  unmount(handle) {
    render(null, handle.root);
  },
};
