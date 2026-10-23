// Ported from react-aria-components `ColorSwatchPicker` (packages/react-aria-components/src/ColorSwatchPicker.tsx), Apache-2.0, © Adobe.
// A ColorSwatchPicker displays a list of color swatches and allows a user to select one of them.
// Rivet:
// - built on the RAC ListBox port (`../listbox/index.tsx`, live collection: the rendered options are the collection).
// - the selection is the color state, not a copy: the listbox gets the single-key backing `selectedKey` = an accessor of
//   `getColor(state).toString("hexa")` with `selectedKeyControlled` (never written); `onSelectionChange` sets the color.
// - RAC's `Map<string, Color>` (filled from item effects) is a plain record key → color string (`ColorMapContext`):
//   items register while rendering (server included), so it serializes; a missing entry falls back to `parseColor(key)`.
// - `ColorSwatchContext` gets the item's color as a string (Color instances are not serializable); item render props
//   carry `color` as an accessor.
// `render` (RAC DOMRenderProps) on the picker (`<div>`) and item (`<div>`): passed to ListBox / ListBoxItem (render props of the list parts; the item's lack `color`).
import { createContext, onCleanup, provide, useContext } from "@rivetjs/reactivity";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { createColorPickerState, getColor, parseColor, setColor, toColor, type Color, type ColorInput } from "@rivetjs/cdk/color";
import { getStringsForLocale, useLocale } from "@rivetjs/cdk/i18n";
import type { Key, Selection } from "../collections/types.ts";
import { ColorSwatchContext } from "../color-swatch/index.tsx";
import { ListBox, ListBoxItem, type ListBoxItemRenderProps, type ListBoxRenderProps } from "../listbox/index.tsx";
import { contextProps, type ChildrenOrFunction, type ContextValue, type RefValue, type SlotProps, type StyleRenderProps } from "../slots/index.tsx";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import type { HoverEvents, PressEvents } from "../utils/types.ts";
import { colorSwatchPickerMessages } from "./intl.ts";

export interface ColorSwatchPickerRenderProps extends Omit<ListBoxRenderProps, "isDropTarget"> {}

export interface ColorSwatchPickerProps
  extends
    StyleRenderProps<ColorSwatchPickerRenderProps>,
    DOMRenderProps<"div", ColorSwatchPickerRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The current value (controlled): a two-way Signal, an accessor or a fixed value. */
  value?: ColorInput;
  /** The default value (uncontrolled). */
  defaultValue?: string | Color;
  /** Handler that is called when the value changes. */
  onChange?: (value: Color) => void;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ColorSwatchPicker'
   */
  class?: StyleRenderProps<ColorSwatchPickerRenderProps>["class"];
  /** The children of the ColorSwatchPicker. */
  children?: unknown;
  /**
   * Whether the items are arranged in a stack or grid.
   *
   * @default 'grid'
   */
  layout?: "grid" | "stack";
  /** The element's id. */
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `ColorSwatchPickerContext`. */
export const ColorSwatchPickerContext = createContext<ContextValue<ColorSwatchPickerProps, HTMLDivElement>>(null);
/** RAC `ColorMapContext` (internal): `toString("hexa")` key → the item's color string. */
const ColorMapContext = createContext<Record<string, string> | null>(null);

/** A ColorSwatchPicker displays a list of color swatches and allows a user to select one of them. */
export function ColorSwatchPicker(props: ColorSwatchPickerProps) {
  const [merged, ref] = contextProps(props, props.ref, ColorSwatchPickerContext);
  const state = createColorPickerState(merged);
  const colorMap: Record<string, string> = {};
  const { locale } = useLocale();
  const ariaLabel = merged["aria-label"] || (!merged["aria-labelledby"] ? getStringsForLocale(colorSwatchPickerMessages, locale).colorSwatchPicker : undefined);
  const dom = globalDOMProps(merged, ["style"]);
  const children = merged.children;
  const listProps = {
    ...dom,
    ref,
    id: merged.id,
    slot: merged.slot,
    render: merged.render,
    class: merged.class || "rv-ColorSwatchPicker",
    style: merged.style,
    "aria-label": ariaLabel,
    "aria-labelledby": merged["aria-labelledby"],
    "aria-describedby": merged["aria-describedby"],
    "aria-details": merged["aria-details"],
    children,
    layout: merged.layout || "grid",
    selectionMode: "single",
    disallowEmptySelection: true,
    selectedKey: () => getColor(state).toString("hexa"),
    selectedKeyControlled: true,
    onSelectionChange: (keys: Selection) => {
      // single select, 'all' cannot occur. appease typescript.
      if (keys !== "all") {
        const key = [...keys][0] as Key | undefined;
        if (key != null) setColor(state, toColor(colorMap[key] ?? null) ?? parseColor(String(key)));
      }
    },
  };
  return provide(ColorMapContext, colorMap, () => <ListBox {...(listProps as {})} />);
}

export interface ColorSwatchPickerItemRenderProps extends Omit<ListBoxItemRenderProps, "selectionMode" | "selectionBehavior"> {
  /** The color of the swatch. */
  color: () => Color;
}

export interface ColorSwatchPickerItemProps
  extends
    StyleRenderProps<ColorSwatchPickerItemRenderProps>,
    DOMRenderProps<"div", ColorSwatchPickerItemRenderProps>,
    HoverEvents,
    PressEvents,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "onClick" | "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ColorSwatchPickerItem'
   */
  class?: StyleRenderProps<ColorSwatchPickerItemRenderProps>["class"];
  /** The children of the item. A function may be provided to alter the children based on component state. */
  children?: ChildrenOrFunction<ColorSwatchPickerItemRenderProps>;
  /** The color of the swatch. */
  color: string | Color;
  /** Whether the color swatch is disabled. */
  isDisabled?: boolean;
  ref?: RefValue<HTMLElement>;
}

/** An item in a ColorSwatchPicker (RAC `ColorSwatchPickerItem`). */
export function ColorSwatchPickerItem(props: ColorSwatchPickerItemProps) {
  const propColor = props.color || "#0000";
  const color = typeof propColor === "string" ? parseColor(propColor) : propColor;
  const key = color.toString("hexa");
  const colorString = color.toString();
  const { locale } = useLocale();
  const map = useContext(ColorMapContext);
  if (map) {
    map[key] = colorString;
    onCleanup(() => {
      if (map[key] === colorString) delete map[key];
    });
  }
  const colorOf = () => parseColor(colorString);
  const className = props.class || "rv-ColorSwatchPickerItem";
  const style = props.style;
  const children = props.children;
  const itemProps = {
    ...props,
    // ColorSwatchPickerItem is never a link.
    id: key,
    textValue: color.getColorName(locale),
    // Unconditional arrows (resumable): RAC `wrap` adds `color` to the render props.
    class: (v: ListBoxItemRenderProps) => (typeof className === "function" ? className({ ...v, color: colorOf } as never) : className),
    style: (v: ListBoxItemRenderProps) => (typeof style === "function" ? style({ ...v, color: colorOf } as never) : style),
    children: (v: ListBoxItemRenderProps & { defaultChildren: unknown }) =>
      provide(ColorSwatchContext, { color: colorString }, () =>
        typeof children === "function" && !isSlot(children) ? (children as (v: unknown) => unknown)({ ...v, color: colorOf }) : renderSlot(children),
      ),
  };
  delete (itemProps as { color?: unknown }).color;
  return <ListBoxItem {...(itemProps as {})} />;
}
