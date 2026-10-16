// Ported from react-stately `useColorPickerState` (packages/react-stately/src/color/useColorPickerState.ts), Apache-2.0, © Adobe.
// Rivet: plain signals + JSON (serializable); `state.color` → `getColor(state)`, `state.setColor(c)` →
// `setColor(state, c)`. Color stored as a string (`./value.ts`).
import { normalizeColor, parseColor, toColor, type Color } from "./color.ts";
import { colorCell, isColorSource, writeColor, type ColorCell, type ColorInput } from "./value.ts";

export interface ColorPickerProps {
  /** The current value (controlled): a two-way signal or a fixed value. */
  value?: ColorInput;
  /** The default value (uncontrolled). */
  defaultValue?: string | Color;
  /** Handler that is called when the value changes. */
  onChange?: (value: Color) => void;
}

export interface ColorPickerState {
  readonly kind: "picker";
  readonly cell: ColorCell<string | Color>;
  readonly onChange: ((value: Color) => void) | undefined;
}

export function createColorPickerState(props: ColorPickerProps): ColorPickerState {
  const value = isColorSource(props.value) ? props.value : toColor(props.value as string | Color | undefined);
  const defaultValue = toColor(props.defaultValue || "#000000")!;
  const cell = colorCell<string | Color>((value || undefined) as ColorInput | undefined, defaultValue);
  return { kind: "picker", cell, onChange: props.onChange };
}

/** The current color value of the color picker. */
export const getColor = (state: ColorPickerState): Color => normalizeColor(state.cell.read());

/** Sets the current color value of the color picker (null is ignored). */
export function setColor(state: ColorPickerState, color: Color | null): void {
  if (color != null) {
    writeColor(state.cell, color || parseColor("#000000"), state.onChange);
  }
}
