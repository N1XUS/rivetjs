// Ported from react-stately `useColorFieldState` (packages/react-stately/src/color/useColorFieldState.ts), Apache-2.0, © Adobe.
// Rivet: plain signals + JSON (serializable); methods are free functions taking the state first
// (`state.commit()` → `commit(state)`; `increment` / `decrement` dispatch on `state.kind` in `./index.ts`).
// - Color stored as a string (`./value.ts`); `colorValue(state)` parses it.
// - Upstream's "set state during render" sync (`prevValue !== colorValue` → reformat the input) is
//   derived: the input signal stores `{ text, key }` (`key` = the color's `colorKey` when the text was
//   set); while the color still has that key the text shows, otherwise the formatted color does.
// - Upstream compares colors by identity (`newValue === colorValue`, useControlledState `Object.is`);
//   here by `colorKey` (same space + channels).
// - Validation = `createFormValidationState` (`state.validation`, functions from
//   `@rivetjs/cdk/state/form-validation`); a user `validate` receives the parsed Color | null.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { commitValidation, createFormValidationState, type FormValidationOptions, type FormValidationState } from "@rivetjs/cdk/state/form-validation";
import { colorKey, parseColor, stringifyColor, toColor, type Color } from "./color.ts";
import { colorCell, isColorSource, writeColor, type ColorCell, type ColorInput } from "./value.ts";

export interface ColorFieldProps extends Omit<FormValidationOptions<Color | null>, "validate"> {
  /** The current value (controlled): a two-way signal or a fixed value. */
  value?: ColorInput<string | Color | null>;
  /** The default value (uncontrolled). */
  defaultValue?: string | Color | null;
  /** Handler that is called when the value changes. */
  onChange?: (color: Color | null) => void;
  /** Custom client validation of the current value. */
  validate?: (value: Color | null) => string | string[] | true | null | undefined;
  /** Whether the input is disabled. */
  isDisabled?: boolean;
  /** Whether the input can be selected but not changed by the user. */
  isReadOnly?: boolean;
  /** Whether user input is required on the input before form submission. */
  isRequired?: boolean;
}

export interface ColorFieldState {
  readonly kind: "field";
  readonly cell: ColorCell<string | Color | null | undefined>;
  /** Whether `value` was given (upstream `value === undefined` check in `commit`). */
  readonly controlled: boolean;
  /** Input text and the color key it was typed against. */
  readonly input: Signal<{ text: string; key: string | null | undefined }>;
  /** The default value of the color field (lossless color string, or null / undefined). */
  readonly defaultColorValue: string | null | undefined;
  /** Form validation state of the field. */
  readonly validation: FormValidationState;
  readonly onChange: ((color: Color | null) => void) | undefined;
}

const MIN_COLOR = "#000000";
const MAX_COLOR = "#FFFFFF";

const hex = (color: Color | null | undefined): string => (color ? color.toString("hex") : "");

/**
 * Provides state management for a color field component. Color fields allow
 * users to enter and adjust a hex color value.
 */
export function createColorFieldState(props: ColorFieldProps): ColorFieldState {
  const { value, defaultValue, onChange } = props;

  const initialDefaultValue = toColor(defaultValue);
  const controlledInput = isColorSource(value) ? value : toColor(value as string | Color | null | undefined);
  const cell = colorCell<string | Color | null | undefined>(controlledInput as ColorInput<string | Color | null | undefined> | undefined, initialDefaultValue);
  const initial = toColor(untrack(cell.read));
  // Upstream validates `colorValue` (the parsed Color | null): with a custom `validate`, a resumable accessor (this
  // module is .tsx; a wrapper around `validate` in a .ts module made a resumed ColorField with `validate` unserializable).
  // Without one only `validate` reads the value: the raw cell (plain state, keeps the resume-table round trip).
  const validation = createFormValidationState<Color | null>({
    ...props,
    value: props.validate ? validationValue(cell) : (cell.read as () => Color | null),
  });
  return {
    kind: "field",
    cell,
    controlled: value !== undefined,
    input: signal({ text: (value || defaultValue) && initial ? hex(initial) : "", key: colorKey(initial) }),
    defaultColorValue: initialDefaultValue ? stringifyColor(initialDefaultValue) : initial ? stringifyColor(initial) : initial,
    validation,
    onChange,
  };
}

/** The value custom `validate` receives (upstream `colorValue`): a resumable accessor (R2 return value). */
function validationValue(cell: ColorCell<string | Color | null | undefined>): () => Color | null {
  return () => toColor(cell.read()) ?? null;
}

/** The currently parsed color value, or null / undefined if the field is empty. */
export const colorValue = (state: ColorFieldState): Color | null | undefined => toColor(state.cell.read());

/** The default value of the color field. */
export const defaultColorValue = (state: ColorFieldState): Color | null | undefined => toColor(state.defaultColorValue);

/** The current text value of the input. Updated as the user types, and formatted on commit. */
export function inputValue(state: ColorFieldState): string {
  const color = colorValue(state);
  const input = state.input();
  return input.key === colorKey(color) ? input.text : hex(color);
}

/** Sets the current text value of the input. */
export function setInputValue(state: ColorFieldState, value: string): void {
  setInputAt(state, value, colorKey(untrack(() => colorValue(state))));
}

function setInputAt(state: ColorFieldState, text: string, key: string | null | undefined): void {
  state.input.set({ text, key });
}

/** Sets the color value of the field. */
export function setColorValue(state: ColorFieldState, value: Color | null): void {
  writeColor(state.cell, value, state.onChange);
}

function safelySetColorValue(state: ColorFieldState, newColor: Color | null): void {
  const current = untrack(() => colorValue(state));
  if (!current || !newColor) {
    setColorValue(state, newColor);
    return;
  }
  if (newColor.toHexInt() !== current.toHexInt()) {
    setColorValue(state, newColor);
    return;
  }
}

function parsedValue(state: ColorFieldState): Color | null {
  const text = untrack(() => inputValue(state));
  let color;
  try {
    color = parseColor(text.startsWith("#") ? text : `#${text}`);
  } catch {
    color = null;
  }
  return color;
}

/** Updates the input value based on the currently parsed color value. Typically this is called when the field is blurred. */
export function commit(state: ColorFieldState): void {
  const text = untrack(() => inputValue(state));
  const current = untrack(() => colorValue(state));
  // Upstream sets the input against the render-time color: a changed color then reformats it.
  const key = colorKey(current);
  // Set to empty state if input value is empty
  if (!text.length) {
    safelySetColorValue(state, null);
    if (!state.controlled || current === null) {
      setInputAt(state, "", key);
    } else {
      setInputAt(state, hex(current), key);
    }
    return;
  }

  const parsed = parsedValue(state);
  // if it failed to parse, then reset input to formatted version of current number
  if (parsed == null) {
    setInputAt(state, hex(current), key);
    return;
  }

  safelySetColorValue(state, parsed);
  // in a controlled state, the numberValue won't change, so we won't go back to our old input without help
  setInputAt(state, hex(current), key);
  commitValidation(state.validation);
}

function addColorValue(color: Color | null, step: number): Color {
  let newColor = color ? color : parseColor(MIN_COLOR);
  const colorInt = newColor.toHexInt();
  const minInt = parseColor(MIN_COLOR).toHexInt();
  const maxInt = parseColor(MAX_COLOR).toHexInt();

  const clampInt = Math.min(Math.max(colorInt + step, minInt), maxInt);
  if (clampInt !== colorInt) {
    const newColorString = `#${clampInt.toString(16).padStart(6, "0").toUpperCase()}`;
    newColor = parseColor(newColorString);
  }
  return newColor;
}

function step(state: ColorFieldState, delta: number): void {
  const { step } = parseColor(MIN_COLOR).getChannelRange("red");
  const newValue = addColorValue(parsedValue(state), delta * step);
  const current = untrack(() => colorValue(state));
  // if we've arrived at the same value that was previously in the state, the
  // input value should be updated to match
  // ex type 4, press increment, highlight the number in the input, type 4 again, press increment
  // you'd be at 5, then incrementing to 5 again, so no re-render would happen and 4 would be left in the input
  if (colorKey(newValue) === colorKey(current)) {
    setInputAt(state, newValue.toString("hex"), colorKey(current));
  }
  safelySetColorValue(state, newValue);
  commitValidation(state.validation);
}

/** Increments the current input value to the next step boundary, and fires `onChange`. */
export const incrementColorField = (state: ColorFieldState): void => step(state, 1);
/** Decrements the current input value to the next step boundary, and fires `onChange`. */
export const decrementColorField = (state: ColorFieldState): void => step(state, -1);
/** Sets the current value to the maximum color value, and fires `onChange`. */
export const incrementToMax = (state: ColorFieldState): void => safelySetColorValue(state, parseColor(MAX_COLOR));
/** Sets the current value to the minimum color value, and fires `onChange`. */
export const decrementToMin = (state: ColorFieldState): void => safelySetColorValue(state, parseColor(MIN_COLOR));

/**
 * Validates a user input string. Values can be partially entered, and may be valid even if they
 * cannot currently be parsed to a color. Can be used to implement validation as a user types.
 */
export const validate = (value: string): boolean => value === "" || !!value.match(/^#?[0-9a-f]{0,6}$/i)?.[0];
