// Ported from react-aria `useColorArea` + `useColorAreaGradient`
// (packages/react-aria/src/color/useColorArea.ts, useColorAreaGradient.ts), Apache-2.0, © Adobe.
// Rivet:
// - `useColorArea(props, state)` → `colorAreaProps(props, state)` (the four RA bags) plus the pieces it is made
//   of: attribute functions (`colorAreaStyle`, `colorAreaThumbStyle`, `colorAreaInputValueText`,
//   `colorAreaInputTabIndex`, `colorAreaInputHidden`, …) and the hook's handlers as free functions
//   (`colorAreaPointerDown`, `colorAreaThumbPointerDown`, `colorAreaThumbKeyDown`, `colorAreaInputFocus`,
//   `colorAreaInputChange`, `colorAreaThumbFocusOut`). Components wire the handlers from inline arrows
//   (resumable); the bags' handler closures are for client-rendered custom markup only.
// - The hook's `useState` / `useRef` values live in `props.interaction` (`createColorAreaInteraction()`:
//   signals + JSON), the refs are `ref()` element refs; `locale` / `direction` are resolved at render
//   (`useLocale()`) and passed in.
// - `useGlobalListeners` → window listeners added / removed by the handlers; `useFormReset` installs on the
//   first focus of an input; `useFocusWithin` → focusin / focusout handlers on the thumb.
// Deviation: `isIOS() || isAndroid()` is read in the browser only (server markup never branches on the
// user agent), so the server renders the desktop tab order; handlers re-evaluate it.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { formatString, getStringsForLocale, type Direction } from "@rivetjs/cdk/i18n";
import { focusWithoutScrolling, useFormReset, useLabels } from "@rivetjs/cdk/utils";
import { isAndroid, isIOS } from "@rivetjs/cdk/platform";
import { keyboardKeyDown } from "../interactions/keyboard.tsx";
import { getOwnerWindow, read, type MaybeAccessor } from "../interactions/utils.ts";
import { moveKeyDown, movePointerDown, type MoveMoveEvent } from "../interactions/move.tsx";
import { focusWithinBlur, focusWithinFocus } from "../interactions/focus.tsx";
import {
  colorAreaDefaultValue,
  colorAreaValue,
  decrementX,
  decrementY,
  getChannelSteps,
  getChannels,
  getColorAreaDisplayColor,
  getColorAreaThumbPosition,
  incrementX,
  incrementY,
  setColorAreaDragging,
  setColorAreaValue,
  setColorFromPoint,
  setXValue,
  setYValue,
  type ColorAreaProps,
  type ColorAreaState,
} from "../color/area-state.ts";
import { parseColor, type Color, type ColorChannel } from "../color/color.ts";
import { colorAriaMessages, type ColorAriaMessageKey } from "../color/aria-intl.ts";

export interface AriaColorAreaProps extends ColorAreaProps {
  /** The element's unique identifier. */
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /** The name of the x channel input element, used when submitting an HTML form. */
  xName?: string;
  /** The name of the y channel input element, used when submitting an HTML form. */
  yName?: string;
  /** The `<form>` element to associate the ColorArea with (id of a `<form>` in the same document). */
  form?: string;
}

/** Per-move bookkeeping of `useMove` (JSON). */
interface MoveState {
  didMove: boolean;
  lastPosition: { pageX: number; pageY: number } | null;
  id: number | null;
}

/** Rivet: the hook's `useState` / `useRef` values (signals + JSON, resumable). */
export interface ColorAreaInteraction {
  /** Which input is focused / last moved (`useState<'x' | 'y' | null>`). */
  readonly focusedInput: Signal<"x" | "y" | null>;
  readonly valueChangedViaKeyboard: Signal<boolean>;
  readonly valueChangedViaInputChangeEvent: Signal<boolean>;
  readonly refs: {
    /** `currentPosition` ref. */
    position: { x: number; y: number } | null;
    /** `currentPointer` ref: `active` false = `undefined` upstream. */
    pointer: { active: boolean; id: number | null };
    /** `isOnColorArea` ref. */
    onArea: boolean;
    /** Global listener in place: "thumb" (`onThumbUp`), "area" (`onColorAreaUp`) or none. */
    up: "thumb" | "area" | null;
    moveThumb: MoveState;
    moveArea: MoveState;
    within: { isFocusWithin: boolean; globals: (() => void)[] };
    formReset: boolean;
  };
}

export interface AriaColorAreaOptions extends Omit<AriaColorAreaProps, "isDisabled"> {
  /** Whether the color area is disabled: a value, or an accessor that stays live (live props P5; handlers read it at event time). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** A ref to the input that represents the x axis of the color area. */
  inputXRef: () => HTMLInputElement | undefined;
  /** A ref to the input that represents the y axis of the color area. */
  inputYRef: () => HTMLInputElement | undefined;
  /** A ref to the color area containing element. */
  containerRef: () => Element | undefined;
  /** Rivet: locale (`useLocale().locale`, resolved at render). */
  locale: string;
  /** Rivet: writing direction (`useLocale().direction`). */
  direction: Direction;
  /** Rivet: the hook's local state (`createColorAreaInteraction()`). */
  interaction: ColorAreaInteraction;
}

export interface ColorAreaAria {
  /** Props for the color area container element. */
  colorAreaProps: Record<string, unknown>;
  /** Props for the thumb element. */
  thumbProps: Record<string, unknown>;
  /** Props for the visually hidden horizontal range input element. */
  xInputProps: Record<string, unknown>;
  /** Props for the visually hidden vertical range input element. */
  yInputProps: Record<string, unknown>;
}

const newMove = (): MoveState => ({ didMove: false, lastPosition: null, id: null });

/** Rivet: the hook-local state of one color area. */
export function createColorAreaInteraction(): ColorAreaInteraction {
  return {
    focusedInput: signal<"x" | "y" | null>(null),
    valueChangedViaKeyboard: signal(false),
    valueChangedViaInputChangeEvent: signal(false),
    refs: {
      position: null,
      pointer: { active: false, id: null },
      onArea: false,
      up: null,
      moveThumb: newMove(),
      moveArea: newMove(),
      within: { isFocusWithin: false, globals: [] },
      formReset: false,
    },
  };
}

const strings = (locale: string): Record<ColorAriaMessageKey, string> => getStringsForLocale(colorAriaMessages, locale);
const isMobile = (): boolean => !!(isIOS() || isAndroid());

function focusInput(props: AriaColorAreaOptions, inputRef: () => HTMLInputElement | undefined = props.inputXRef): void {
  const input = inputRef();
  if (input) focusWithoutScrolling(input);
}

function keyboardUpdate(
  props: AriaColorAreaOptions,
  state: ColorAreaState,
  cb: () => void,
  inputRef: () => HTMLInputElement | undefined,
  input: "x" | "y",
): void {
  setColorAreaDragging(state, true);
  props.interaction.valueChangedViaKeyboard.set(true);
  cb();
  setColorAreaDragging(state, false);
  focusInput(props, inputRef);
  props.interaction.focusedInput.set(input);
}

// moveHandler
function moveStart(props: AriaColorAreaOptions, state: ColorAreaState): void {
  props.interaction.refs.position = null;
  setColorAreaDragging(state, true);
}

function moveMove(props: AriaColorAreaOptions, state: ColorAreaState, { deltaX, deltaY, pointerType, shiftKey }: MoveMoveEvent): void {
  const { interaction, direction } = props;
  const refs = interaction.refs;
  const { xChannelPageStep, xChannelStep, yChannelPageStep, yChannelStep } = untrack(() => getChannelSteps(state));
  if (refs.position == null) {
    refs.position = untrack(() => getColorAreaThumbPosition(state));
  }
  const { width, height } = props.containerRef()?.getBoundingClientRect() || { width: 0, height: 0 };
  const valueChanged = deltaX !== 0 || deltaY !== 0;
  if (pointerType === "keyboard") {
    const deltaXValue = shiftKey && xChannelPageStep > xChannelStep ? xChannelPageStep : xChannelStep;
    const deltaYValue = shiftKey && yChannelPageStep > yChannelStep ? yChannelPageStep : yChannelStep;
    if ((deltaX > 0 && direction === "ltr") || (deltaX < 0 && direction === "rtl")) {
      incrementX(state, deltaXValue);
    } else if ((deltaX < 0 && direction === "ltr") || (deltaX > 0 && direction === "rtl")) {
      decrementX(state, deltaXValue);
    } else if (deltaY > 0) {
      decrementY(state, deltaYValue);
    } else if (deltaY < 0) {
      incrementY(state, deltaYValue);
    }
    interaction.valueChangedViaKeyboard.set(valueChanged);
    // set the focused input based on which axis has the greater delta
    interaction.focusedInput.set(valueChanged && Math.abs(deltaY) > Math.abs(deltaX) ? "y" : "x");
  } else {
    refs.position.x += ((direction === "rtl" ? -1 : 1) * deltaX) / width;
    refs.position.y += deltaY / height;
    setColorFromPoint(state, refs.position.x, refs.position.y);
  }
}

function moveEnd(props: AriaColorAreaOptions, state: ColorAreaState): void {
  props.interaction.refs.onArea = false;
  setColorAreaDragging(state, false);
  const input = untrack(props.interaction.focusedInput) === "x" ? props.inputXRef : props.inputYRef;
  focusInput(props, input);
}

function thumbMove(props: AriaColorAreaOptions, state: ColorAreaState) {
  return {
    props: { onMoveStart: () => moveStart(props, state), onMove: (e: MoveMoveEvent) => moveMove(props, state, e), onMoveEnd: () => moveEnd(props, state) },
    state: props.interaction.refs.moveThumb,
  };
}

function areaMove(props: AriaColorAreaOptions, state: ColorAreaState) {
  const refs = props.interaction.refs;
  return {
    props: {
      onMoveStart: () => {
        if (refs.onArea) moveStart(props, state);
      },
      onMove: (e: MoveMoveEvent) => {
        if (refs.onArea) moveMove(props, state, e);
      },
      onMoveEnd: () => {
        if (refs.onArea) moveEnd(props, state);
      },
    },
    state: refs.moveArea,
  };
}

// Global `pointerup` listeners (useGlobalListeners): one per area, keyed by the options object.
const upListeners = new WeakMap<ColorAreaInteraction, { listener: (e: PointerEvent) => void; win: Window }>();

function addUp(props: AriaColorAreaOptions, state: ColorAreaState, kind: "thumb" | "area"): void {
  const listener = (e: PointerEvent) => (kind === "thumb" ? onThumbUp(props, state, e) : onColorAreaUp(props, state, e));
  // The element's window (no bare `window`: this module is resume-compiled, server-checked).
  const win = getOwnerWindow(props.containerRef());
  upListeners.set(props.interaction, { listener, win });
  props.interaction.refs.up = kind;
  win.addEventListener("pointerup", listener, false);
}

function removeUp(props: AriaColorAreaOptions): void {
  const entry = upListeners.get(props.interaction);
  if (entry) entry.win.removeEventListener("pointerup", entry.listener, false);
  upListeners.delete(props.interaction);
  props.interaction.refs.up = null;
}

function onThumbDown(props: AriaColorAreaOptions, state: ColorAreaState, id: number | null): void {
  const { interaction } = props;
  if (!untrack(() => state.dragging())) {
    interaction.refs.pointer = { active: true, id };
    interaction.valueChangedViaKeyboard.set(false);
    focusInput(props);
    setColorAreaDragging(state, true);
    addUp(props, state, "thumb");
  }
}

function onThumbUp(props: AriaColorAreaOptions, state: ColorAreaState, e: PointerEvent): void {
  const { interaction } = props;
  const pointer = interaction.refs.pointer;
  if (pointer.active && e.pointerId === pointer.id) {
    interaction.valueChangedViaKeyboard.set(false);
    focusInput(props);
    setColorAreaDragging(state, false);
    interaction.refs.pointer = { active: false, id: null };
    interaction.refs.onArea = false;
    removeUp(props);
  }
}

function onColorAreaDown(props: AriaColorAreaOptions, state: ColorAreaState, colorArea: Element, id: number | null, clientX: number, clientY: number): void {
  const { interaction } = props;
  const rect = colorArea.getBoundingClientRect();
  const { width, height } = rect;
  let x = (clientX - rect.x) / width;
  const y = (clientY - rect.y) / height;
  if (props.direction === "rtl") {
    x = 1 - x;
  }
  if (x >= 0 && x <= 1 && y >= 0 && y <= 1 && !untrack(() => state.dragging()) && !interaction.refs.pointer.active) {
    interaction.refs.onArea = true;
    interaction.valueChangedViaKeyboard.set(false);
    interaction.refs.pointer = { active: true, id };
    setColorFromPoint(state, x, y);

    focusInput(props);
    setColorAreaDragging(state, true);
    addUp(props, state, "area");
  }
}

function onColorAreaUp(props: AriaColorAreaOptions, state: ColorAreaState, e: PointerEvent): void {
  const { interaction } = props;
  const pointer = interaction.refs.pointer;
  if (interaction.refs.onArea && pointer.active && e.pointerId === pointer.id) {
    interaction.refs.onArea = false;
    interaction.valueChangedViaKeyboard.set(false);
    interaction.refs.pointer = { active: false, id: null };
    setColorAreaDragging(state, false);
    focusInput(props);
    removeUp(props);
  }
}

const ignoredButton = (e: PointerEvent): boolean => e.pointerType === "mouse" && (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey);

/** Color area container `pointerdown` (RA colorAreaInteractions: area down + container useMove). No-op when disabled. */
export function colorAreaPointerDown(e: PointerEvent, props: AriaColorAreaOptions, state: ColorAreaState): void {
  if (read(props.isDisabled)) return;
  if (!ignoredButton(e)) onColorAreaDown(props, state, e.currentTarget as Element, e.pointerId, e.clientX, e.clientY);
  movePointerDown(areaMove(props, state), e);
}

/** Thumb `pointerdown` (RA thumbInteractions: thumb down + thumb useMove). No-op when disabled. */
export function colorAreaThumbPointerDown(e: PointerEvent, props: AriaColorAreaOptions, state: ColorAreaState): void {
  if (read(props.isDisabled)) return;
  if (!ignoredButton(e)) onThumbDown(props, state, e.pointerId);
  movePointerDown(thumbMove(props, state), e);
}

/** Keys `colorAreaThumbKeyDown` handles (thumb `data-rk`: held while a cold chunk loads). */
export const COLOR_AREA_KEYS = "ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown Home End";

/** Thumb `keydown` (RA useKeyboard shortcuts PageUp / PageDown / Home / End + useMove arrow keys). */
export function colorAreaThumbKeyDown(e: KeyboardEvent, props: AriaColorAreaOptions, state: ColorAreaState): void {
  if (read(props.isDisabled)) return;
  const { direction, inputXRef, inputYRef } = props;
  const { xChannelPageStep, yChannelPageStep } = untrack(() => getChannelSteps(state));
  keyboardKeyDown(
    {
      shortcuts: {
        PageUp: () => keyboardUpdate(props, state, () => incrementY(state, yChannelPageStep), inputYRef, "y"),
        PageDown: () => keyboardUpdate(props, state, () => decrementY(state, yChannelPageStep), inputYRef, "y"),
        Home: () =>
          keyboardUpdate(props, state, () => (direction === "rtl" ? incrementX(state, xChannelPageStep) : decrementX(state, xChannelPageStep)), inputXRef, "x"),
        End: () =>
          keyboardUpdate(props, state, () => (direction === "rtl" ? decrementX(state, xChannelPageStep) : incrementX(state, xChannelPageStep)), inputXRef, "x"),
      },
      allowRepeats: true,
    },
    e,
  );
  moveKeyDown(thumbMove(props, state), e);
}

/** Thumb `focusin` (RA useFocusWithin). */
export function colorAreaThumbFocusIn(e: FocusEvent, props: AriaColorAreaOptions): void {
  if (read(props.isDisabled)) return;
  focusWithinFocus({ props: { onFocusWithinChange: (v) => focusWithinChange(props, v) }, state: props.interaction.refs.within }, e);
}

/** Thumb `focusout` (RA useFocusWithin: leaving the thumb resets the "changed via" flags). */
export function colorAreaThumbFocusOut(e: FocusEvent, props: AriaColorAreaOptions): void {
  if (read(props.isDisabled)) return;
  focusWithinBlur({ props: { onFocusWithinChange: (v) => focusWithinChange(props, v) }, state: props.interaction.refs.within }, e);
}

function focusWithinChange(props: AriaColorAreaOptions, focusWithin: boolean): void {
  if (!focusWithin) {
    props.interaction.valueChangedViaKeyboard.set(false);
    props.interaction.valueChangedViaInputChangeEvent.set(false);
  }
}

/** Input `focus` (RA useFocus on each input) + `useFormReset` installed on first use. */
export function colorAreaInputFocus(_e: FocusEvent, props: AriaColorAreaOptions, state: ColorAreaState, input: "x" | "y"): void {
  props.interaction.focusedInput.set(input);
  if (!props.interaction.refs.formReset) {
    props.interaction.refs.formReset = true;
    const defaultValue = untrack(() => colorAreaDefaultValue(state));
    useFormReset(props.inputXRef(), defaultValue, (value: Color) => setColorAreaValue(state, value));
  }
}

/** Input `change` (both inputs). */
export function colorAreaInputChange(e: Event, props: AriaColorAreaOptions, state: ColorAreaState): void {
  const target = e.target as HTMLInputElement;
  props.interaction.valueChangedViaInputChangeEvent.set(true);
  if (target === props.inputXRef()) {
    setXValue(state, parseFloat(target.value));
  } else if (target === props.inputYRef()) {
    setYValue(state, parseFloat(target.value));
  }
}

/** `aria-valuetext` of the input for `axis` (reads the state + interaction signals). */
export function colorAreaInputValueText(props: AriaColorAreaOptions, state: ColorAreaState, axis: "x" | "y"): string {
  const { locale, interaction } = props;
  const s = strings(locale);
  const value = getColorAreaDisplayColor(state);
  const { xChannel, yChannel, zChannel } = getChannels(state);
  const channel = axis === "x" ? xChannel : yChannel;
  const isAfterInput = interaction.valueChangedViaInputChangeEvent() || interaction.valueChangedViaKeyboard();
  const nameAndValue = (c: ColorChannel) =>
    formatString(s.colorNameAndValue, { name: value.getChannelName(c, locale), value: value.formatChannelValue(c, locale) });
  return `${
    isAfterInput ? nameAndValue(channel) : [nameAndValue(channel), nameAndValue(channel === yChannel ? xChannel : yChannel), nameAndValue(zChannel)].join(", ")
  }, ${value.getColorName(locale)}`;
}

/** `tabIndex` of the input for `axis` (roving: one tab stop). */
export function colorAreaInputTabIndex(props: AriaColorAreaOptions, axis: "x" | "y"): number | undefined {
  const focused = props.interaction.focusedInput();
  if (axis === "x") return isMobile() || !focused || focused === "x" ? undefined : -1;
  return isMobile() || focused === "y" ? undefined : -1;
}

/**
 * `aria-hidden` of the input for `axis`: only a single "2d slider" shows up when listing form elements,
 * until the value changed via the keyboard.
 */
export function colorAreaInputHidden(props: AriaColorAreaOptions, axis: "x" | "y"): "true" | undefined {
  const focused = props.interaction.focusedInput();
  const changed = props.interaction.valueChangedViaKeyboard();
  if (axis === "x") return isMobile() || !focused || focused === "x" || changed ? undefined : "true";
  return isMobile() || focused === "y" || changed ? undefined : "true";
}

/** Labelling props of both inputs (RA `useLabels` with "<label>, Color picker"). */
export function colorAreaInputLabels(props: AriaColorAreaOptions): { id?: string; "aria-label"?: string; "aria-labelledby"?: string } {
  const s = strings(props.locale);
  const ariaLabel = props["aria-label"];
  return useLabels({
    "aria-labelledby": props["aria-labelledby"],
    "aria-label": ariaLabel ? formatString(s.colorInputLabel, { label: ariaLabel, channelLabel: s.colorPicker }) : s.colorPicker,
  });
}

/** Labelling props of the group (RA `useLabels(…, isMobile ? colorPicker : undefined)`). */
export function colorAreaGroupLabels(props: AriaColorAreaOptions): { id?: string; "aria-label"?: string; "aria-labelledby"?: string } {
  const s = strings(props.locale);
  const ariaLabel = props["aria-label"];
  return useLabels(
    { id: props.id, "aria-labelledby": props["aria-labelledby"], "aria-label": ariaLabel ? `${ariaLabel}, ${s.colorPicker}` : undefined },
    isMobile() ? s.colorPicker : undefined,
  );
}

/** Static input attributes (min / max / step / orientation / roledescription) for `axis`. */
export function colorAreaInputRange(props: AriaColorAreaOptions, state: ColorAreaState, axis: "x" | "y"): { min: number; max: number; step: number } {
  const value = colorAreaValue(state);
  const { xChannel, yChannel } = getChannels(state);
  const range = value.getChannelRange(axis === "x" ? xChannel : yChannel);
  const steps = getChannelSteps(state);
  return { min: range.minValue, max: range.maxValue, step: axis === "x" ? steps.xChannelStep : steps.yChannelStep };
}

/** The input's value for `axis`. */
export function colorAreaInputValue(state: ColorAreaState, axis: "x" | "y"): number {
  const { xChannel, yChannel } = getChannels(state);
  return colorAreaValue(state).getChannelValue(axis === "x" ? xChannel : yChannel);
}

/** `aria-roledescription` of both inputs ("2D slider"). */
export const colorAreaRoleDescription = (props: { locale: string }): string => strings(props.locale).twoDimensionalSlider;

/** RA `useVisuallyHidden({style: {opacity, width, height, pointerEvents}})` style of the inputs. */
export const colorAreaInputStyle = {
  border: "0",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  margin: "-1px",
  overflow: "hidden",
  padding: "0",
  position: "absolute",
  whiteSpace: "nowrap",
  opacity: "0.0001",
  width: "100%",
  height: "100%",
  pointerEvents: "none",
} as const;

// useColorAreaGradient
const hue = (color: Color) => [0, 60, 120, 180, 240, 300, 360].map((h) => color.withChannelValue("hue", h).toString("css")).join(", ");
const saturation = (color: Color) => `${color.withChannelValue("saturation", 0)}, transparent`;
const hslChannels: Record<string, (c: Color) => string> = { hue, saturation, lightness: () => "black, transparent, white" };
const hsbChannels: Record<string, (c: Color) => string> = { hue, saturation, brightness: () => "black, transparent" };

/** RA `useColorAreaGradient` → `colorAreaStyleProps.style` (container: position, touch-action, gradient background). */
export function colorAreaStyle(props: { direction: Direction }, state: ColorAreaState): Record<string, string> {
  const { direction } = props;
  const { xChannel, yChannel, zChannel } = getChannels(state);
  const end = direction === "rtl" ? "left" : "right";
  let colorAreaStyles: Record<string, string> = {};
  const value = colorAreaValue(state);
  const zValue = value.getChannelValue(zChannel);

  switch (value.getColorSpace()) {
    case "rgb": {
      const rgb = parseColor("rgb(0, 0, 0)");
      colorAreaStyles = {
        background: [
          // The screen blend mode multiplies the inverse of each channel, e.g. 1 - (1 - a) * (1 - b).
          // Create a layer for each channel, with the other channels as 0. After blending, this should
          // result in the gradients being combined channel by channel.
          `linear-gradient(to ${end}, ${rgb.withChannelValue(xChannel, 0)}, ${rgb.withChannelValue(xChannel, 255)})`,
          `linear-gradient(to top, ${rgb.withChannelValue(yChannel, 0)}, ${rgb.withChannelValue(yChannel, 255)})`,
          rgb.withChannelValue(zChannel, zValue),
        ].join(","),
        backgroundBlendMode: "screen",
      };
      break;
    }
    case "hsl":
    case "hsb": {
      const space = value.getColorSpace();
      const channels = value.getColorChannels();
      const base = parseColor(space === "hsl" ? "hsl(0, 100%, 50%)" : "hsb(0, 100%, 100%)").withChannelValue(zChannel, zValue);
      const table = space === "hsl" ? hslChannels : hsbChannels;
      const bg = channels
        .filter((c) => c !== zChannel)
        .map((c) => `linear-gradient(to ${c === xChannel ? end : "top"}, ${table[c]!(base)})`)
        .reverse();
      if (zChannel === "hue") {
        bg.push(base.toString("css"));
      }
      colorAreaStyles = { background: bg.join(", ") };
      break;
    }
  }
  return { position: "relative", touchAction: "none", forcedColorAdjust: "none", ...colorAreaStyles };
}

/** RA `useColorAreaGradient` → `thumbStyleProps.style` (absolute position at the value). */
export function colorAreaThumbStyle(props: { direction: Direction }, state: ColorAreaState): Record<string, string> {
  let { x, y } = getColorAreaThumbPosition(state);
  if (props.direction === "rtl") {
    x = 1 - x;
  }
  return { position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, transform: "translate(-50%, -50%)", touchAction: "none", forcedColorAdjust: "none" };
}

/**
 * react-aria `useColorArea`: the four attribute bags (values read now; handler closures not resumable —
 * components wire the exported handler functions from inline arrows instead).
 */
export function colorAreaProps(props: AriaColorAreaOptions, state: ColorAreaState): ColorAreaAria {
  // Values read now; a live `isDisabled` (accessor) keeps the handlers (they check the current value).
  const isDisabled = typeof props.isDisabled !== "function" && !!props.isDisabled;
  const disabledNow = read(props.isDisabled);
  const roledescription = colorAreaRoleDescription(props);
  const input = (axis: "x" | "y") => ({
    ...colorAreaInputLabels(props),
    style: colorAreaInputStyle,
    onFocus: (e: FocusEvent) => colorAreaInputFocus(e, props, state, axis),
    type: "range",
    ...colorAreaInputRange(props, state, axis),
    "aria-roledescription": roledescription,
    "aria-valuetext": colorAreaInputValueText(props, state, axis),
    "aria-orientation": axis === "x" ? "horizontal" : "vertical",
    "aria-describedby": props["aria-describedby"],
    "aria-details": props["aria-details"],
    disabled: disabledNow,
    value: colorAreaInputValue(state, axis),
    name: axis === "x" ? props.xName : props.yName,
    form: props.form,
    tabIndex: colorAreaInputTabIndex(props, axis),
    "aria-hidden": colorAreaInputHidden(props, axis),
    onChange: (e: Event) => colorAreaInputChange(e, props, state),
  });
  return {
    colorAreaProps: {
      ...colorAreaGroupLabels(props),
      ...(isDisabled ? {} : { onPointerDown: (e: PointerEvent) => colorAreaPointerDown(e, props, state) }),
      style: colorAreaStyle(props, state),
      role: "group",
    },
    thumbProps: {
      ...(isDisabled
        ? {}
        : {
            onPointerDown: (e: PointerEvent) => colorAreaThumbPointerDown(e, props, state),
            onKeyDown: (e: KeyboardEvent) => colorAreaThumbKeyDown(e, props, state),
            onFocusIn: (e: FocusEvent) => colorAreaThumbFocusIn(e, props),
            onFocusOut: (e: FocusEvent) => colorAreaThumbFocusOut(e, props),
          }),
      style: colorAreaThumbStyle(props, state),
      role: "presentation",
    },
    xInputProps: input("x"),
    yInputProps: input("y"),
  };
}
