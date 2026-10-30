import { createComponent, createRoot, mergeProps, type Component } from "solid-js";
import { createStore, reconcile, type SetStoreFunction } from "solid-js/store";
import { hydrate, render } from "solid-js/web";
import type { ClientAdapter } from "@rivetjs/bridge/adapter";
import { slotProp } from "./slot.ts";

type Props = Record<string, unknown>;
type SolidComponent = Component<any>;
interface Handle {
  dispose: () => void;
  set: SetStoreFunction<Props>;
  disposed: boolean;
}

function start(root: Element, component: SolidComponent, props: Props, slots: Record<string, Node[] | null>, id: string, hydrating: boolean): Handle {
  let disposeTree: () => void = () => {};
  try {
    const [store, set] = createStore<Props>({ ...props });
    const slotProps: Props = {};
    for (const [name, nodes] of Object.entries(slots)) {
      let hole: Element | undefined;
      Object.defineProperty(slotProps, slotProp(name), {
        enumerable: true,
        get() {
          if (!hole) {
            // Raw ssr(mark.html) holes have no data-hk and must not consume a Solid hydration key.
            hole = hydrating
              ? [...root.querySelectorAll("rivet-slot")].find((el) => (el.getAttribute("name") ?? "default") === name && el.closest("rivet-island") === root)
              : undefined;
            if (!hole) {
              hole = document.createElement("rivet-slot");
              if (name !== "default") hole.setAttribute("name", name);
              (hole as HTMLElement).style.display = "contents";
            }
            // Hydration retains the existing Rivet nodes; client mounts move the same nodes into the new hole.
            if (nodes) for (const node of nodes) if (node.parentNode !== hole) hole.appendChild(node);
          }
          return hole;
        },
      });
    }
    // A component root with a captured disposer is independent of web.render's detached root. Even when
    // render throws before returning its own disposer, all component effects and cleanups remain reachable here.
    const tree = () =>
      createRoot((dispose) => {
        disposeTree = dispose;
        return createComponent(component, mergeProps(store, slotProps));
      });
    const stop = hydrating ? hydrate(tree, root, { renderId: id }) : render(tree, root);
    return {
      dispose: () => {
        try {
          stop();
        } finally {
          disposeTree();
        }
      },
      set,
      disposed: false,
    };
  } catch (error) {
    disposeTree();
    throw error;
  }
}

export const adapter: ClientAdapter<SolidComponent, Handle> = {
  hydrate(root, component, props, slots, ctx) {
    return start(root, component, props, slots, ctx.id, true);
  },
  mount(root, component, props, slots, ctx) {
    return start(root, component, props, slots, ctx.id, false);
  },
  update(handle, props) {
    if (!handle.disposed) handle.set(reconcile({ ...props }));
  },
  unmount(handle) {
    if (handle.disposed) return;
    handle.disposed = true;
    handle.dispose();
  },
};
