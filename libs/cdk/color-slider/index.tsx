// Ported from react-aria-components `ColorSlider` (packages/react-aria-components/src/ColorSlider.tsx), Apache-2.0, © Adobe.
// A color slider allows users to adjust an individual channel of a color value.
// Children: `<Label />`, `<SliderOutput />`, `<SliderTrack><ColorThumb /></SliderTrack>` (Slider parts, `../slider`).
// Rivet:
// - state = `createColorSliderState` (`@rivetjs/cdk/color`: plain signals + JSON); `value` = plain value, read-only
//   accessor (ColorPicker) or two-way Signal (string | Color); `SliderStateContext` gets `sliderView(state)` (the
//   transient slider view over the channel; RAC passes the color slider state, a slider state superset).
// - the track gradient, thumb position and input value text are bindings (`colorSliderTrackStyle`, …); handlers are
//   inline arrows over the `./behaviour.tsx` free functions (resumable).
// - the `<Label>` children default to the channel name (RAC `LabelContext` `children`).
// - render props are accessors (`isDisabled()`, `orientation()`); `state` is the serializable state object.
// `render` (RAC DOMRenderProps): given, the attributes object (reactive entries are accessors) goes to `render(attrs, renderProps)` instead of the default element.
import { createContext, untrack } from "@rivetjs/reactivity";
import { ref as createRef } from "@rivetjs/runtime/dom";
import { createColorSliderState, getDisplayColor, getValue, sliderView, type ColorSliderState } from "@rivetjs/cdk/color";
import { isThumbSnapping, type Orientation } from "../slider/state.ts";
import { isColorSliderDragging } from "../color/slider-state.tsx";
import { useLocale } from "@rivetjs/cdk/i18n";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { LabelContext } from "../label/index.tsx";
import { sliderProps, sliderThumbProps } from "../slider/behaviour.tsx";
import { SliderOutputContext, SliderStateContext, SliderTrackContext } from "../slider/index.tsx";
import {
  Provider,
  contextProps,
  createSlot,
  renderPropsOf,
  type ContextValue,
  type ProviderValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
} from "../slots/index.tsx";
import { InternalColorThumbContext } from "../color-thumb/index.tsx";
import {
  colorSliderAriaLabel,
  colorSliderInputBlur,
  colorSliderInputChange,
  colorSliderInputFocus,
  colorSliderInputStyle,
  colorSliderInputValueText,
  colorSliderThumbKeyDown,
  colorSliderThumbOptions,
  colorSliderThumbPointerDown,
  colorSliderThumbStyle,
  colorSliderTrackPointerDown,
  colorSliderTrackStyle,
  createColorSliderInteraction,
  type AriaColorSliderOptions,
  type AriaColorSliderProps,
} from "./behaviour.tsx";
import { liveAssign, liveOptions } from "../utils/live.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";

export * from "./behaviour.tsx";

export interface ColorSliderRenderProps {
  /**
   * The orientation of the color slider.
   *
   * @selector [data-orientation="horizontal | vertical"]
   */
  orientation: () => Orientation;
  /**
   * Whether the color slider is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /** State of the color slider. */
  state: ColorSliderState;
}

export interface ColorSliderProps
  extends
    Omit<AriaColorSliderProps, "label">,
    RenderProps<ColorSliderRenderProps>,
    DOMRenderProps<"div", ColorSliderRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | "onChange"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ColorSlider'
   */
  class?: RenderProps<ColorSliderRenderProps>["class"];
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `ColorSliderContext`. */
export const ColorSliderContext = createContext<ContextValue<Partial<ColorSliderProps>, HTMLDivElement>>(null);
/** RAC `ColorSliderStateContext`. */
export const ColorSliderStateContext = createContext<ColorSliderState | null>(null);

const OWNED = ["style", "id", "render"] as const;

/** `data-disabled` of a live `isDisabled` (a returned arrow: resumable symbol; goes into the spread bag). */
function liveDisabledAttr(flag: () => boolean | undefined): () => true | undefined {
  return () => !!flag() || undefined;
}

/**
 * A color slider allows users to adjust an individual channel of a color value.
 */
export function ColorSlider(props: ColorSliderProps) {
  const [ctxMerged, ref] = contextProps(props, props.ref, ColorSliderContext);
  // Live props (P5): `isDisabled` and a controlled `value={c()}` become accessors (the slider state / handlers read
  // them; the value is never written); the rest of the body is read once (untracked: a prop change never re-creates).
  const merged = liveOptions(ctxMerged, ["isDisabled"], ["value"]);
  return untrack(() => colorSlider(merged, ref));
}

function colorSlider(merged: ColorSliderProps, ref: RefValue<HTMLDivElement> | undefined) {
  const { locale, direction } = useLocale();
  const state = createColorSliderState({ ...merged, locale });
  const trackRef = createRef<HTMLDivElement>();
  const inputRef = createRef<HTMLInputElement>();
  const initialLabel = !merged["aria-label"] && !merged["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  // A live `isDisabled` is an accessor: the handlers stay attached and check it at event time.
  const isDisabled = merged.isDisabled as MaybeAccessor<boolean | undefined>;
  const disabledFlag = typeof isDisabled === "function" ? liveDisabledAttr(isDisabled) : undefined;
  const dropHandlers = !disabledFlag && !!isDisabled;
  const orientation = merged.orientation ?? "horizontal";
  const opts: AriaColorSliderOptions = {
    channel: merged.channel,
    orientation,
    isDisabled,
    id: merged.id,
    name: merged.name,
    form: merged.form,
    label: initialLabel,
    "aria-label": merged["aria-label"],
    "aria-labelledby": merged["aria-labelledby"],
    "aria-describedby": merged["aria-describedby"],
    "aria-details": merged["aria-details"],
    trackRef,
    inputRef,
    locale,
    direction,
    interaction: createColorSliderInteraction(),
  };

  const view = sliderView(state);
  const { groupProps, trackProps, labelProps, outputProps } = sliderProps(
    { ...opts, "aria-label": untrack(() => colorSliderAriaLabel(opts, state)) } as never,
    view,
  );
  const thumb = sliderThumbProps(colorSliderThumbOptions(opts), view);

  // RA re-renders with `label: false` when no Label renders: the group then gets the channel name as aria-label.
  const labelledBy = groupProps["aria-labelledby"] as string | undefined;
  const ownLabelledBy = merged["aria-labelledby"];
  const ownLabel = merged["aria-label"];
  const channelName = untrack(() => getValue(state)).getChannelName(merged.channel, locale);
  const { style: _trackStyle, ...trackAttrs } = trackProps as Record<string, unknown>;
  const track = {
    ...groupProps,
    ...trackAttrs,
    // Unconditional arrows (a conditional arrow is not resume-compiled).
    "aria-labelledby": () => (!initialLabel || hasLabel() ? labelledBy : ownLabelledBy),
    "aria-label": () => (!initialLabel ? ownLabel : hasLabel() ? undefined : channelName),
    style: () => colorSliderTrackStyle(opts, state),
    ...(dropHandlers ? {} : { onPointerDown: (e: PointerEvent) => colorSliderTrackPointerDown(e, opts, state) }),
    ref: trackRef,
  };

  const inputAttrs = thumb.inputProps;
  const xInputProps = () => ({
    ...inputAttrs,
    "aria-valuetext": colorSliderInputValueText(opts, state),
    onChange: (e: Event) => colorSliderInputChange(e, opts, state),
    onFocus: (e: FocusEvent) => colorSliderInputFocus(e, opts, state),
    onBlur: (e: FocusEvent) => colorSliderInputBlur(e, opts, state),
  });
  const thumbProps = dropHandlers
    ? { role: "presentation" }
    : {
        role: "presentation",
        onKeyDown: (e: KeyboardEvent) => colorSliderThumbKeyDown(e, opts, state),
        onPointerDown: (e: PointerEvent) => colorSliderThumbPointerDown(e, opts, state),
      };
  const thumbContext = {
    displayColor: () => getDisplayColor(state),
    isDragging: () => isColorSliderDragging(state),
    isSnapping: () => isThumbSnapping(state.slider, 0),
    thumbProps,
    thumbStyle: () => colorSliderThumbStyle(opts, state),
    inputXRef: inputRef,
    inputStyle: colorSliderInputStyle,
    xInputProps,
    isDisabled,
  };

  const values: ColorSliderRenderProps = { orientation: () => orientation, isDisabled: () => !!read(isDisabled), state };
  const rp = renderPropsOf<ColorSliderRenderProps>(merged, { values, defaultClassName: "rv-ColorSlider" });
  // `data-disabled` goes through the spread bag (a function attribute value outside a spread is not a server binding,
  // and an explicit attribute after the spread would override the bag's key); none is added while enabled (static).
  const disabledAttr = disabledFlag ?? ((isDisabled as boolean | undefined) || undefined);
  const dom = disabledAttr ? liveAssign(globalDOMProps(merged, OWNED), { "data-disabled": disabledAttr }) : globalDOMProps(merged, OWNED);
  const slot = merged.slot || undefined;
  const label = {
    ...labelProps,
    ref: labelRef,
    children: channelName,
  };
  const providers: ProviderValue<any>[] = [
    [ColorSliderStateContext, state],
    [SliderStateContext, view],
    [SliderTrackContext, track],
    [SliderOutputContext, outputProps],
    // RA label onClick (Safari focus) as an inline arrow here: a handler assigned onto the bag does not resume.
    [LabelContext, label],
    [InternalColorThumbContext, thumbContext],
  ];
  const children = rp.children;
  if (merged.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      class: () => rp.class(),
      style: () => rp.style(),
      slot,
      "data-orientation": orientation,
      "data-disabled": disabledAttr,
      children: () => <Provider values={providers}>{children()}</Provider>,
    };
    return merged.render(attrs as never, values);
  }
  return (
    <div {...dom} ref={ref as never} class={rp.class()} style={rp.style()} slot={slot} data-orientation={orientation}>
      <Provider values={providers}>{children()}</Provider>
    </div>
  );
}
