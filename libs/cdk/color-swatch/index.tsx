// Ported from react-aria-components `ColorSwatch` (packages/react-aria-components/src/ColorSwatch.tsx), Apache-2.0, © Adobe.
// A ColorSwatch displays a preview of a selected color.
// Rivet:
// - `color` may be an accessor (`() => string | Color`, e.g. from ColorPicker / ColorSwatchPickerItem via
//   `ColorSwatchContext`): name, label and background are bindings over it.
// - render props are accessors (`color()`); `style` may be a function of them (`({ color, defaultStyle }) => …`).
// `render` (RAC DOMRenderProps): given, the attributes object (reactive entries are accessors) goes to `render(attrs, renderProps)` instead of the default element.
import { createContext, untrack } from "@rivetjs/reactivity";
import type { Color } from "@rivetjs/cdk/color";
import { useLocale } from "@rivetjs/cdk/i18n";
import { createId } from "@rivetjs/cdk/id";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import {
  contextProps,
  renderProps,
  type ChildrenOrFunction,
  type ContextValue,
  type RefValue,
  type SlotProps,
  type StyleRenderProps,
} from "../slots/index.tsx";
import { colorSwatchColor, colorSwatchProps, type AriaColorSwatchProps } from "./behaviour.ts";
import { hasLive, liveOptions } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import { read } from "../interactions/utils.ts";

export * from "./behaviour.ts";

export interface ColorSwatchRenderProps {
  /** The color of the swatch. */
  color: () => Color;
}

export interface ColorSwatchProps
  extends
    Omit<AriaColorSwatchProps, "color">,
    StyleRenderProps<ColorSwatchRenderProps>,
    DOMRenderProps<"div", ColorSwatchRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The color value to display in the swatch (Rivet: or an accessor of it). */
  color?: string | Color | (() => string | Color | undefined);
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ColorSwatch'
   */
  class?: StyleRenderProps<ColorSwatchRenderProps>["class"];
  /** Rivet: RAC renders `children` through useRenderProps at runtime (untyped upstream); a function of the render props. */
  children?: ChildrenOrFunction<ColorSwatchRenderProps>;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `ColorSwatchContext`. */
export const ColorSwatchContext = createContext<ContextValue<ColorSwatchProps, HTMLDivElement>>(null);

const OWNED = ["style", "id", "children", "render"] as const;

/**
 * A ColorSwatch displays a preview of a selected color.
 */
export function ColorSwatch(props: ColorSwatchProps) {
  // Live props (P5): `color` / `colorName` become accessors (read in the attribute / style bindings), class / style /
  // children from a live view; the rest of the body is read once (untracked).
  return untrack(() => colorSwatch(props));
}

function colorSwatch(props: ColorSwatchProps) {
  const [ctxMerged, ref] = contextProps(props, props.ref, ColorSwatchContext);
  const merged = hasLive(ctxMerged) ? liveOptions(ctxMerged, ["color", "colorName"]) : ctxMerged;
  const { locale } = useLocale();
  const colorProp = merged.color;
  const id = merged.id || createId();
  const colorName = merged.colorName;
  const ariaLabel = merged["aria-label"];
  const labelledBy = merged["aria-labelledby"];
  const describedBy = merged["aria-describedby"];
  const details = merged["aria-details"];
  const value = () => (typeof colorProp === "function" ? colorProp() : colorProp);
  const aria = () =>
    colorSwatchProps({ color: value(), colorName: read(colorName), id, locale, "aria-label": ariaLabel, "aria-labelledby": labelledBy }).colorSwatchProps;
  const color = () => colorSwatchColor(value());
  const values: ColorSwatchRenderProps = { color };
  const rp = renderProps<ColorSwatchRenderProps>(
    {
      class: merged.class,
      style: merged.style,
      children: merged.children,
      defaultClassName: "rv-ColorSwatch",
      values,
    },
    hasLive(merged) ? (liveRenderProps(merged) as never) : undefined,
  );
  const ownStyle = merged.style;
  const style = () => {
    const defaultStyle = { ...aria().style };
    const computed = typeof ownStyle === "function" ? ownStyle({ color, defaultStyle }) : ownStyle;
    return { ...defaultStyle, ...computed };
  };
  const dom = globalDOMProps(merged, OWNED);
  const slot = merged.slot || undefined;
  const children = rp.children;
  if (merged.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      id,
      role: "img",
      "aria-roledescription": () => aria()["aria-roledescription"],
      "aria-label": () => aria()["aria-label"],
      "aria-labelledby": () => aria()["aria-labelledby"],
      "aria-describedby": describedBy,
      "aria-details": details,
      class: () => rp.class(),
      style,
      slot,
      children: () => children(),
    };
    return merged.render(attrs as never, values);
  }
  return (
    <div
      {...dom}
      ref={ref as never}
      id={id}
      role="img"
      aria-roledescription={aria()["aria-roledescription"]}
      aria-label={aria()["aria-label"]}
      aria-labelledby={aria()["aria-labelledby"]}
      aria-describedby={describedBy}
      aria-details={details}
      class={rp.class()}
      style={style()}
      slot={slot}
    >
      {children()}
    </div>
  );
}
