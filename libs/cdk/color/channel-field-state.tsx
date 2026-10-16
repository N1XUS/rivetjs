// Ported from react-stately `useColorChannelFieldState` (packages/react-stately/src/color/useColorChannelFieldState.ts), Apache-2.0, © Adobe.
// Rivet: plain signals + JSON (serializable); methods are free functions taking the state first.
// Upstream spreads `useNumberFieldState` into the result; here `state.numberField` is the stored
// `NumberFieldState` data (input text, sync record) and `numberFieldView(state)` builds, per call, a
// transient `NumberFieldState` whose value reads the color channel (÷ multiplier) and whose writes set
// the color — pass it to the `@rivetjs/cdk/number` functions (`commit(numberFieldView(state))`).
// Color stored as a string (`./value.ts`).
import { untrack, type Signal } from "@rivetjs/reactivity";
import { createNumberFieldState, type NumberFieldState } from "../number/number-field-state.tsx";
import { parseColor, stringifyColor, toColor, type Color, type ColorChannel, type ColorSpace } from "./color.ts";
import { colorCell, isColorSource, writeColor, type ColorCell, type ColorInput } from "./value.ts";

export interface ColorChannelFieldProps {
  /** The current value (controlled): a two-way signal or a fixed value. */
  value?: ColorInput<string | Color | null>;
  /** The default value (uncontrolled). */
  defaultValue?: string | Color | null;
  /** Handler that is called when the value changes. */
  onChange?: (color: Color | null) => void;
  colorSpace?: ColorSpace;
  channel: ColorChannel;
  /** Whether the input is disabled. */
  isDisabled?: boolean;
  /** Whether the input can be selected but not changed by the user. */
  isReadOnly?: boolean;
}

export interface ColorChannelFieldStateOptions extends ColorChannelFieldProps {
  locale: string;
}

export interface ColorChannelFieldState {
  readonly kind: "channel-field";
  readonly cell: ColorCell<string | Color | null | undefined>;
  readonly channel: ColorChannel;
  readonly colorSpace: ColorSpace | undefined;
  /** Percent channels with a 0–100 range are edited as 0–1 (upstream `multiplier`). */
  readonly multiplier: number;
  /** The default value of the field (lossless color string, or null). */
  readonly defaultColorValue: string | null;
  /** Stored number field data; use `numberFieldView(state)` with the number field functions. */
  readonly numberField: NumberFieldState;
  readonly onChange: ((color: Color | null) => void) | undefined;
}

const BLACK = "#000";

function convertColor(colorValue: Color | null | undefined, colorSpace: ColorSpace | null | undefined): Color {
  const nonNullColorValue = colorValue || parseColor(BLACK);
  return colorSpace && nonNullColorValue ? nonNullColorValue.toFormat(colorSpace) : nonNullColorValue;
}

/**
 * Provides state management for a color channel field, allowing users to edit the
 * value of an individual color channel.
 */
export function createColorChannelFieldState(props: ColorChannelFieldStateOptions): ColorChannelFieldState {
  const { channel, colorSpace, locale } = props;
  const initialValue = isColorSource(props.value) ? props.value : toColor(props.value as string | Color | null | undefined);
  const initialDefaultValue = toColor(props.defaultValue);
  const cell = colorCell<string | Color | null | undefined>(
    initialValue as ColorInput<string | Color | null | undefined> | undefined,
    initialDefaultValue ?? null,
  );
  const colorValue = toColor(untrack(cell.read)) ?? null;
  const color = convertColor(colorValue, colorSpace);
  const defaultColorValue = initialDefaultValue ?? colorValue;
  const defaultColor = convertColor(defaultColorValue, colorSpace);
  const value = color.getChannelValue(channel);
  const range = color.getChannelRange(channel);
  const formatOptions = color.getChannelFormatOptions(channel);
  const multiplier = formatOptions.style === "percent" && range.maxValue === 100 ? 100 : 1;

  const numberField = createNumberFieldState({
    locale,
    value: colorValue === null ? NaN : value / multiplier,
    defaultValue: defaultColorValue === null ? NaN : defaultColor.getChannelValue(channel) / multiplier,
    minValue: range.minValue / multiplier,
    maxValue: range.maxValue / multiplier,
    step: range.step / multiplier,
    formatOptions,
  });

  return {
    kind: "channel-field",
    cell,
    channel,
    colorSpace,
    multiplier,
    defaultColorValue: defaultColorValue ? stringifyColor(defaultColorValue) : null,
    numberField,
    onChange: props.onChange,
  };
}

/** The current value of the field (black when empty, in `colorSpace` when given). */
export const channelFieldColorValue = (state: ColorChannelFieldState): Color => convertColor(toColor(state.cell.read()), state.colorSpace);

/** The default value of the field. */
export const channelFieldDefaultColorValue = (state: ColorChannelFieldState): Color | null => toColor(state.defaultColorValue) ?? null;

/** Sets the color value of the field. */
export function setChannelFieldColorValue(state: ColorChannelFieldState, value: Color | null): void {
  writeColor(state.cell, value, state.onChange);
}

/**
 * Transient `NumberFieldState` over the color channel (upstream: the spread `useNumberFieldState`
 * result): controlled by the channel value, `onChange` writes the color (NaN → null). Build it per
 * call; never store it (it holds closures).
 */
export function numberFieldView(state: ColorChannelFieldState): NumberFieldState {
  const read = () => {
    const colorValue = toColor(state.cell.read());
    return colorValue == null ? NaN : convertColor(colorValue, state.colorSpace).getChannelValue(state.channel) / state.multiplier;
  };
  return {
    ...state.numberField,
    value: read as Signal<number | null>,
    controlled: true,
    fixed: true,
    onChange: (v: number) => {
      if (!Number.isNaN(v)) {
        const color = untrack(() => channelFieldColorValue(state));
        setChannelFieldColorValue(state, color.withChannelValue(state.channel, v * state.multiplier));
      } else {
        setChannelFieldColorValue(state, null);
      }
    },
  };
}
