// Client adapter of the fake framework: a component's `attach(root, props, slots, fresh)` hydrates (fresh = false:
// attach to the server HTML) or mounts (writes it); every call is logged to `window.__fake`.
import { log, VERSION } from "./runtime.js";
export const adapter = {
  hydrate(root, component, props, slots, ctx) {
    log("hydrate", ctx.id, VERSION);
    return component.attach(root, props, slots, false);
  },
  mount(root, component, props, slots, ctx) {
    log("mount", ctx.id);
    return component.attach(root, props, slots, true);
  },
  update(handle, props) {
    log("update", JSON.stringify(Object.fromEntries(Object.entries(props).filter(([, v]) => typeof v !== "function"))));
    handle.update(props);
  },
  unmount(handle) {
    log("unmount");
    handle.destroy();
  },
};
