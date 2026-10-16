import { component, h } from "../fake/runtime.js";
// A fake-framework counter: server HTML, client attach (button → onIncrement), props rendered on update.
export const Counter = component({
  html: (props, slots) => `<div class="counter">${h("span", "count", props.count)}<button>+</button>${slots.default?.html ?? ""}</div>`,
  attach(root, props, slots, fresh) {
    if (fresh) {
      root.innerHTML = `<div class="counter">${h("span", "count", props.count)}<button>+</button><rivet-slot style="display:contents"></rivet-slot></div>`;
      root.querySelector("rivet-slot")?.append(...(slots.default ?? []));
    }
    let current = props;
    const span = root.querySelector(".count");
    const button = root.querySelector("button");
    const click = () => current.onIncrement?.(1);
    button.addEventListener("click", click);
    return {
      update(next) {
        current = next;
        span.textContent = String(next.count);
      },
      destroy() {
        button.removeEventListener("click", click);
      },
    };
  },
});
