// Ported from react-aria-components `ColorPicker` (packages/react-aria-components/src/ColorPicker.tsx), Apache-2.0, © Adobe.
// A ColorPicker synchronizes a color value between multiple React Aria color components (ColorArea, ColorSlider,
// ColorWheel, ColorField, ColorSwatch, ColorSwatchPicker). It renders no element of its own.
// Rivet:
// - state = `createColorPickerState` (`@rivetjs/cdk/color`); `value` = plain value or two-way Signal (string | Color).
// - the child contexts get `value: () => color` (a read-only accessor: the child only calls `onChange`, RAC's
//   `value={state.color} onChange={state.setColor}`) and `onChange` = inline arrow over `setColor`.
// - render props are accessors (`({ color }) => … color() …`).
import { createContext } from "@rivetjs/reactivity";
import {
  createColorPickerState,
  getColor,
  setColor,
  type Color,
  type ColorPickerState,
  type ColorPickerProps as StatelyColorPickerProps,
} from "@rivetjs/cdk/color";
import { mergeProps } from "../interactions/merge-props.tsx";
import { Provider, renderProps, resumableContext, slottedContext, type ChildrenOrFunction, type SlotProps, type SlottedContextValue } from "../slots/index.tsx";
import { ColorAreaContext } from "../color-area/index.tsx";
import { ColorFieldContext } from "../color-field/index.tsx";
import { ColorSliderContext } from "../color-slider/index.tsx";
import { ColorSwatchContext } from "../color-swatch/index.tsx";
import { ColorSwatchPickerContext } from "../color-swatch-picker/index.tsx";
import { ColorWheelContext } from "../color-wheel/index.tsx";
import { liveOptions } from "../utils/live.tsx";

export interface ColorPickerRenderProps {
  /** The currently selected color. */
  color: () => Color;
}

export interface ColorPickerProps extends StatelyColorPickerProps, SlotProps {
  /** The children of the component. A function may be provided to alter the children based on component state. */
  children: ChildrenOrFunction<ColorPickerRenderProps>;
}

/** RAC `ColorPickerContext`. */
export const ColorPickerContext = resumableContext(createContext<SlottedContextValue<Partial<ColorPickerProps>>>(null, { id: "rv-color-picker" }));
/** RAC `ColorPickerStateContext`. */
export const ColorPickerStateContext = resumableContext(createContext<ColorPickerState | null>(null, { id: "rv-color-picker-state" }));

/**
 * A ColorPicker synchronizes a color value between multiple React Aria color components.
 * It simplifies building color pickers with customizable layouts via composition.
 */
export function ColorPicker(props: ColorPickerProps) {
  const ctx = slottedContext(ColorPickerContext, props.slot);
  const merged = mergeProps(ctx, props) as ColorPickerProps;
  // Live props: a controlled `value={c()}` stays live (accessor; the state reads it, never writes it).
  const state = createColorPickerState(liveOptions(merged, [], ["value"]));
  const color = () => getColor(state);
  const rp = renderProps<ColorPickerRenderProps>({ children: merged.children, values: { color } });
  const onChange = (value: Color | null) => setColor(state, value);
  const shared = { value: color, onChange };
  const children = rp.children;
  return (
    <Provider
      values={[
        [ColorPickerStateContext, state],
        [ColorSliderContext, shared],
        [ColorAreaContext, shared],
        [ColorWheelContext, shared],
        [ColorFieldContext, shared],
        [ColorSwatchContext, { color }],
        [ColorSwatchPickerContext, shared],
      ]}
    >
      {children()}
    </Provider>
  );
}
