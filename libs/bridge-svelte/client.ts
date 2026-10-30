import { hydrate, mount, unmount, settled, type Component } from "svelte";
import { islandRecovered, type ClientAdapter } from "@rivetjs/bridge/adapter";
import { discardNativeHead, withNativeHead } from "@rivetjs/bridge/head-client";
import { withSlots } from "./holes.ts";
import { liveProps, replaceProps } from "./props.svelte.ts";

type IslandComponent = Component<Record<string, unknown>>;
interface Handle {
  component: Record<string, unknown>;
  props: Record<string, unknown>;
  slotProps: Record<string, unknown>;
}

// Native hydrate/mount return before experimental async body handlers are installed. Driver readiness must wait.
function initialized(component: Record<string, unknown>, props: Record<string, unknown>, slotProps: Record<string, unknown>): Promise<Handle> {
  return settled().then(
    () => ({ component, props, slotProps }),
    (error) => {
      void unmount(component);
      throw error;
    },
  );
}

export const adapter: ClientAdapter<IslandComponent, Handle> = {
  hydrate(root, component, props, slots, ctx) {
    const slotProps = withSlots({}, slots);
    const current = liveProps({ ...props, ...slotProps });
    // Disable Svelte's automatic recovery: the bridge owns clearing, preserving slots and reporting RV2149.
    const failed = (error: unknown): never => {
      islandRecovered("svelte", ctx.id, error, root);
      throw error;
    };
    try {
      return Promise.resolve(
        withNativeHead("svelte", ctx.id, () => {
          const instance = hydrate(component, { target: root, props: current, recover: false });
          return initialized(instance, current, slotProps);
        }),
      ).catch(failed);
    } catch (error) {
      return failed(error);
    }
  },
  mount(root, component, props, slots, ctx) {
    // A failed hydrate can leave untouched SSR head nodes. Fresh mount owns a new native head tree.
    discardNativeHead("svelte", ctx.id);
    const slotProps = withSlots({}, slots);
    const current = liveProps({ ...props, ...slotProps });
    return initialized(mount(component, { target: root, props: current }), current, slotProps);
  },
  update(handle, props) {
    replaceProps(handle.props, { ...props, ...handle.slotProps });
  },
  unmount(handle) {
    void unmount(handle.component);
  },
};
