import { component, h } from "../fake/runtime.js";
// A component next to non-component exports (a hook, a constant): the facade wraps Badge, re-exports the others.
export function useThing() {
  return "THING";
}
export const MAX = 3;
export const Badge = component({
  html: (props) => h("b", "badge", props.label),
  attach(root, props, _slots, fresh) {
    if (fresh) root.innerHTML = h("b", "badge", props.label);
    const el = root.querySelector(".badge");
    return {
      update(next) {
        el.textContent = String(next.label);
      },
      destroy() {},
    };
  },
});
export default Badge;
