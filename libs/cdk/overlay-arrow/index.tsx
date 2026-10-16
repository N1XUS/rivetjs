// Ported from React Aria Components (OverlayArrow.tsx), Apache-2.0, © Adobe.
// An OverlayArrow renders a custom arrow element relative to an overlay element such as a popover or
// tooltip such that it aligns with a trigger element.
// Rivet:
// - placement comes from `OverlayArrowContext` as a signal (Popover / Tooltip set it after positioning);
//   render props are accessors (`placement()`).
// - the cross-axis offset (RAC `arrowProps.style`) comes from the context `offset` signal (Popover /
//   Tooltip position with `arrowStyle: false`); the element style is RAC's: `position: absolute`, the
//   placement side at `100%`, `translate -50%`, the offset, then the user's `style` (wins).
// - `class` (RAC `className`), default `rv-OverlayArrow`. `render` (RAC DOMRenderProps): given, the attributes object goes to `render(attrs, OverlayArrowRenderProps)` instead of the default `<div>`.
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import { contextProps, renderProps, type RenderProps, type RefValue, type ClassNameOrFunction, type StyleOrFunction } from "../slots/index.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { OverlayArrowContext, type OverlayArrowContextValue } from "../overlay/contexts.ts";
import type { PlacementAxis } from "../overlay/position.ts";
import { renderPropsOf } from "../slots/index.tsx";

export { OverlayArrowContext, type OverlayArrowContextValue };

export interface OverlayArrowRenderProps {
  /** The placement of the overlay relative to the trigger. @selector [data-placement="left | right | top | bottom"] */
  placement: () => PlacementAxis | null;
}

export interface OverlayArrowProps
  extends RenderProps<OverlayArrowRenderProps>, DOMRenderProps<"div", OverlayArrowRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The CSS class for the element. A function may be provided to compute the class based on component state. @default 'rv-OverlayArrow' */
  class?: ClassNameOrFunction<OverlayArrowRenderProps>;
  /** The inline style for the element. A function may be provided to compute the style based on component state. */
  style?: StyleOrFunction<OverlayArrowRenderProps>;
  id?: string;
  ref?: RefValue<HTMLDivElement>;
}

const OWNED = ["style"] as const;

/**
 * An OverlayArrow renders a custom arrow element relative to an overlay element such as a popover or
 * tooltip such that it aligns with a trigger element.
 */
export function OverlayArrow(props: OverlayArrowProps) {
  const [merged, ref] = contextProps(props as OverlayArrowProps & Partial<OverlayArrowContextValue>, props.ref, OverlayArrowContext as never);
  const p = merged as OverlayArrowProps & Partial<OverlayArrowContextValue>;
  const source = p.placement,
    offset = p.offset;
  const placement = (): PlacementAxis | null => (typeof source === "function" ? source() : (source ?? null));
  const rp = renderPropsOf<OverlayArrowRenderProps>(p, {
    defaultClassName: "rv-OverlayArrow",
    values: { placement },
  });
  const style = () => {
    const side = placement();
    const own = rp.style() ?? {};
    // remove undefined values so they do not clear the positioning's
    for (const key of Object.keys(own)) if (own[key] === undefined) delete own[key];
    const base: Record<string, string> = {
      position: "absolute",
      transform: side === "top" || side === "bottom" ? "translateX(-50%)" : "translateY(-50%)",
    };
    if (side != null && side !== "center") base[side] = "100%";
    // RA arrowProps.style (cross-axis offset); RAC: `{...arrowProps.style, ...renderProps.style}`.
    const o = offset?.();
    if (o?.left != null) base.left = o.left + "px";
    if (o?.top != null) base.top = o.top + "px";
    return { ...base, ...own };
  };
  // Read up front: an element with a spread is one binding.
  const domProps = globalDOMProps(p, OWNED),
    id = p.id;
  if (p.render) {
    const attrs = {
      ...domProps,
      id,
      class: () => rp.class(),
      style,
      ref: ref as Ref<HTMLDivElement>,
      "data-placement": () => placement() ?? undefined,
      children: () => rp.children(),
    };
    return p.render(attrs as never, { placement });
  }
  return (
    <div {...domProps} id={id} class={rp.class()} style={style()} ref={ref as Ref<HTMLDivElement>} data-placement={placement() ?? undefined}>
      {rp.children()}
    </div>
  );
}
