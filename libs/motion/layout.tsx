// @rivetjs/motion/layout (spec D12): layout animations on the shared FLIP core `@rivetjs/cdk/flip`. Motion elements
// opt in with `layout` (`true` / `"position"` / `"size"`) and animate inside `animateLayout(scope?, update,
// transition?)`; `layoutId` shares an element across a swap (the new element starts at the box of the one it replaces;
// `LayoutGroup` namespaces the ids). `layoutDriver(transition)` = the WAAPI driver, also for cdk Masonry
// (`motion={layoutDriver(…)}`). Importing this module (named or bare `import "@rivetjs/motion/layout"`: listed in the package `sideEffects`)
// enables `layout` / `layoutId`; without it the core writes the attributes only.
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { Provider } from "@rivetjs/runtime/dom";
import { useContext } from "@rivetjs/reactivity";
import { LayoutGroupContext } from "./element.tsx";
import { layoutReady } from "./layout-engine.ts";

export { animateLayout, layoutDriver } from "./layout-engine.ts";

/** Namespaces the `layoutId`s inside it (`id`, nested groups join with `-`). */
export function LayoutGroup(props: { id?: string; children?: Content | (() => Content) }): JSX.Element {
  layoutReady();
  const outer = useContext(LayoutGroupContext);
  const id = props.id === undefined ? outer : outer ? outer + "-" + props.id : props.id;
  const children = props.children;
  return (
    <Provider token={LayoutGroupContext} value={id}>
      {typeof children === "function" ? (children as () => Content)() : children}
    </Provider>
  ) as JSX.Element;
}
