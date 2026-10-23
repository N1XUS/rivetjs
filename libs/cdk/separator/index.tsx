// Ported from react-aria-components Separator (packages/react-aria-components/src/Separator.tsx), Apache-2.0, © Adobe.
// A visual divider between two groups of content (groups of menu items, sections of a page): `<hr>`,
// or `<div role="separator" aria-orientation="vertical">` when vertical / `elementType` given.
// Rivet: props merged with `SeparatorContext` (`contextProps`); `separatorProps` (RA useSeparator) in
// `behaviour.ts`; a collection leaf (`createLeafComponent(SeparatorNode, …)`, `SeparatorNode.filter` keeps
// a separator only after a non-separator item when filtering, as RAC). `render` (RAC DOMRenderProps): given, the attributes object (`ref`, `class`, `style`) goes to `render(attrs, undefined)` instead of the default element; the default path is the compiled element.
import { createContext } from "@rivetjs/reactivity";
import { Dynamic } from "@rivetjs/runtime/dom";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { mergeProps } from "../interactions/merge-props.tsx";
import { CollectionNode, type BaseCollection } from "../collections/base.ts";
import { createLeafComponent } from "../collections/components.tsx";
import { contextProps, type ContextValue, type RefValue, type SlotProps, type StyleObject } from "../slots/index.tsx";
import { separatorProps, type AriaSeparatorProps } from "./behaviour.ts";
import { isLive, liveClass } from "../utils/live.tsx";

export { separatorProps, type AriaSeparatorProps, type SeparatorAria } from "./behaviour.ts";

export interface SeparatorProps extends AriaSeparatorProps, SlotProps, GlobalDOMAttributes<HTMLElement>, DOMRenderProps<"hr", undefined> {
  /** @default "rv-Separator" */
  class?: string;
  style?: StyleObject;
  ref?: RefValue<HTMLElement>;
}

export const SeparatorContext = createContext<ContextValue<SeparatorProps, HTMLElement>>({});

/** RA `filterDOMProps(props, { global: true })`: global attributes / events, `id`, `data-*`. */
function domPropsOf(props: Record<string, unknown>): Record<string, unknown> {
  const out = globalDOMProps(props);
  for (const key in props) if ((key === "id" || key.startsWith("data-")) && props[key] !== undefined) out[key] = props[key];
  return out;
}

/** Collection node of a separator (RAC `SeparatorNode`). */
export class SeparatorNode extends CollectionNode<any> {
  static override readonly type = "separator";

  override filter(collection: BaseCollection<any>, newCollection: BaseCollection<any>): CollectionNode<any> | null {
    const prevItem = newCollection.getItem(this.prevKey!);
    if (prevItem && prevItem.type !== "separator") {
      const clone = this.clone();
      newCollection.addDescendants(clone, collection);
      return clone;
    }
    return null;
  }
}

/**
 * A separator is a visual divider between two groups of content, e.g. groups of menu items or
 * sections of a page.
 */
export const Separator = /*#__PURE__*/ createLeafComponent<SeparatorProps>(SeparatorNode, function Separator(props: SeparatorProps, forwardedRef: unknown) {
  const [merged, ref] = contextProps(props, forwardedRef as RefValue<HTMLElement> | undefined, SeparatorContext);
  const { elementType, orientation, style, class: className, slot, render } = merged as SeparatorProps;
  let element = elementType || "hr";
  if (element === "hr" && orientation === "vertical") element = "div";
  const aria = separatorProps({ ...(merged as AriaSeparatorProps), elementType, orientation });
  // Live props (P5): a live `class` goes through the spread as an accessor.
  const cls = isLive(merged, "class") ? liveClass(merged, "rv-Separator") : (className ?? "rv-Separator");
  // `class` may be an accessor: the spread binds it (typed as the static string).
  const attrs = mergeProps(domPropsOf(merged as Record<string, unknown>), aria.separatorProps, { class: cls as string });
  const s = slot || undefined;
  const r = ref as never;
  if (render) return render({ ...attrs, style, class: cls, ref: r, slot: s } as never, undefined);
  if (element === "hr") return <hr {...attrs} style={style} ref={r} slot={s} />;
  if (element === "div") return <div {...attrs} style={style} ref={r} slot={s} />;
  return <Dynamic component={element} {...attrs} style={style} ref={r} slot={s} />;
}) as (props: SeparatorProps) => unknown;
