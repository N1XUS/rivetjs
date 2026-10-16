// Live props (P5, docs/design/specs/2026-10-07-live-props-design.md §8): the live path of the plain text parts (Label,
// Text, Header, Heading). Their static path destructures `class` / `style` / `children` into compiled templates;
// with a live prop (own getter) this path renders one `Dynamic` element whose `class` / `style` / children read the
// props inside bindings, and forwards every other prop through the spread unread.
import { untrack } from "@rivetjs/reactivity";
import { Dynamic } from "@rivetjs/runtime/dom";
import { renderSlot } from "@rivetjs/runtime/slot";
import { liveOmit } from "./live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import type { StyleObject } from "../slots/index.tsx";

const OWN = ["elementType", "children", "class", "style", "slot", "render", "ref"] as const;

type Bag = Record<string, unknown>;

/** `class` of live props (a returned arrow: resumable). */
function liveClass(props: Bag, defaultClassName: string): () => string {
  // A function `class` (an accessor, e.g. ui's render-class) is called, as the static path's attribute binding does.
  return () => {
    const className = props.class;
    return ((typeof className === "function" ? (className as () => string | undefined)() : className) as string | undefined) ?? defaultClassName;
  };
}

/** `style` of live props: a value, or an accessor (a returned arrow: resumable). */
function liveStyle(props: Bag): () => StyleObject | undefined {
  return () => {
    const style = props.style;
    return (typeof style === "function" ? (style as () => StyleObject)() : style) as StyleObject | undefined;
  };
}

/**
 * The element of a live-props text part: `elementType` (read once), `class` / `style` / children live, the other
 * props forwarded through the spread (`omit`: extra own keys of the part). `style` is a key only when it was set at
 * creation (the server `Dynamic` rejects a `style` attribute name).
 */
export function liveElement(props: Bag, ref: unknown, elementType: string, defaultClassName: string, omit: readonly string[] = []): unknown {
  const dom = liveOmit(props, [...OWN, ...omit] as never) as Bag;
  // Closures capture one narrow view per key, never the whole props object (a children function capturing a class
  // instance must not reach the class / style bindings on a resumed page).
  const [classView, styleView, childrenView] = liveRenderProps(props) as unknown as [Bag, Bag, Bag];
  const hasStyle = untrack(() => props.style) !== undefined;
  const slot = (untrack(() => props.slot) as string | undefined) ?? undefined;
  const attrs: Bag = hasStyle
    ? { class: liveClass(classView, defaultClassName), style: liveStyle(styleView) }
    : { class: liveClass(classView, defaultClassName) };
  const r = ref as never;
  // Compiled templates for the parts' usual elements (a `Dynamic` element costs more on both targets).
  switch (elementType) {
    case "span":
      return (
        <span {...dom} {...attrs} slot={slot} ref={r}>
          {() => renderSlot(childrenView.children as never)}
        </span>
      );
    case "label":
      return (
        <label {...dom} {...attrs} slot={slot} ref={r}>
          {() => renderSlot(childrenView.children as never)}
        </label>
      );
    case "div":
      return (
        <div {...dom} {...attrs} slot={slot} ref={r}>
          {() => renderSlot(childrenView.children as never)}
        </div>
      );
    case "p":
      return (
        <p {...dom} {...attrs} slot={slot} ref={r}>
          {() => renderSlot(childrenView.children as never)}
        </p>
      );
    case "header":
      return (
        <header {...dom} {...attrs} slot={slot} ref={r}>
          {() => renderSlot(childrenView.children as never)}
        </header>
      );
    case "h2":
      return (
        <h2 {...dom} {...attrs} slot={slot} ref={r}>
          {() => renderSlot(childrenView.children as never)}
        </h2>
      );
    case "h3":
      return (
        <h3 {...dom} {...attrs} slot={slot} ref={r}>
          {() => renderSlot(childrenView.children as never)}
        </h3>
      );
  }
  return (
    <Dynamic component={elementType} {...dom} {...attrs} slot={slot} ref={r}>
      {() => renderSlot(childrenView.children as never)}
    </Dynamic>
  );
}
