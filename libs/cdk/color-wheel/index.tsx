// Ported from react-aria-components `ColorWheel`, `ColorWheelTrack` (packages/react-aria-components/src/ColorWheel.tsx),
// Apache-2.0, © Adobe.
// A color wheel allows users to adjust the hue of an HSL or HSB color value on a circular track.
// Children: `<ColorWheelTrack />` + `<ColorThumb />`.
// Rivet:
// - state = `createColorWheelState` (`@rivetjs/cdk/color`: plain signals + JSON); `value` = plain value or two-way
//   Signal (string | Color); the hook-local state = `createColorWheelInteraction()`; the input ref = `ref()`.
// - handlers are inline arrows over the `./behaviour.tsx` free functions (resumable); the conic gradient + ring
//   clip path are inline styles from JS (`colorWheelTrackStyle`).
// - render props are accessors (`isDisabled()`); `state` is the serializable state object.
// `render` (RAC DOMRenderProps): given, the attributes object (reactive entries are accessors) goes to `render(attrs, renderProps)` instead of the default element.
import { createContext, useContext, untrack } from "@rivetjs/reactivity";
import { hasLive, liveAssign, liveOptions } from "../utils/live.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { isColorWheelDisabled } from "../color/wheel-state.ts";
import { liveRenderProps } from "../slots/index.tsx";
import { ref as createRef } from "@rivetjs/runtime/dom";
import { createColorWheelState, getDisplayColor, isDragging, type ColorWheelState } from "@rivetjs/cdk/color";
import { useLocale } from "@rivetjs/cdk/i18n";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import {
  Provider,
  contextProps,
  renderProps,
  renderPropsOf,
  resumableContext,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleRenderProps,
} from "../slots/index.tsx";
import { InternalColorThumbContext } from "../color-thumb/index.tsx";
import {
  colorWheelInputChange,
  colorWheelInputFocus,
  colorWheelInputLabels,
  colorWheelInputRange,
  colorWheelInputStyle,
  colorWheelInputValue,
  colorWheelInputValueText,
  colorWheelThumbKeyDown,
  colorWheelThumbPointerDown,
  colorWheelThumbStyle,
  colorWheelTrackPointerDown,
  colorWheelTrackStyle,
  createColorWheelInteraction,
  type AriaColorWheelOptions,
  type ColorWheelAriaOptions,
} from "./behaviour.tsx";

export * from "./behaviour.tsx";

export interface ColorWheelRenderProps {
  /**
   * Whether the color wheel is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /** State of the color wheel. */
  state: ColorWheelState;
}

export interface ColorWheelProps
  extends
    AriaColorWheelOptions,
    RenderProps<ColorWheelRenderProps>,
    DOMRenderProps<"div", ColorWheelRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ColorWheel'
   */
  class?: RenderProps<ColorWheelRenderProps>["class"];
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `ColorWheelContext`. */
export const ColorWheelContext = resumableContext(createContext<ContextValue<Partial<ColorWheelProps>, HTMLDivElement>>(null, { id: "rv-color-wheel" }));
/** RAC `ColorWheelStateContext`. */
export const ColorWheelStateContext = resumableContext(createContext<ColorWheelState | null>(null, { id: "rv-color-wheel-state" }));

const OWNED = ["style", "id", "render"] as const;

/** `data-disabled` of a live `isDisabled` (a returned arrow: resumable symbol; goes into the spread bag). */
function liveDisabledAttr(state: ColorWheelState): () => "true" | undefined {
  return () => (isColorWheelDisabled(state) ? "true" : undefined);
}

/**
 * A color wheel allows users to adjust the hue of an HSL or HSB color value on a circular track.
 */
export function ColorWheel(props: ColorWheelProps) {
  const [ctxMerged, ref] = contextProps(props, props.ref, ColorWheelContext);
  // Live props (P5): `isDisabled` and a controlled `value={c()}` become accessors (the state / handlers read them; the
  // value is never written); the rest of the body is read once (untracked: a prop change never re-creates the wheel).
  const merged = liveOptions(ctxMerged, ["isDisabled"], ["value"]);
  return untrack(() => colorWheel(merged, ref));
}

function colorWheel(merged: ColorWheelProps, ref: RefValue<HTMLDivElement> | undefined) {
  const state = createColorWheelState(merged);
  const inputRef = createRef<HTMLInputElement>();
  const { locale } = useLocale();
  // A live `isDisabled` is an accessor: the handlers stay attached and check it at event time.
  const isDisabled = merged.isDisabled as MaybeAccessor<boolean | undefined>;
  const disabledFlag = state.disabled ? liveDisabledAttr(state) : undefined;
  const dropHandlers = !disabledFlag && !!isDisabled;
  const opts: ColorWheelAriaOptions = {
    isDisabled,
    id: merged.id,
    name: merged.name,
    form: merged.form,
    outerRadius: merged.outerRadius,
    innerRadius: merged.innerRadius,
    "aria-label": merged["aria-label"],
    "aria-labelledby": merged["aria-labelledby"],
    "aria-describedby": merged["aria-describedby"],
    "aria-details": merged["aria-details"],
    "aria-errormessage": merged["aria-errormessage"],
    inputRef,
    locale,
    interaction: createColorWheelInteraction(),
  };

  const values: ColorWheelRenderProps = { state, isDisabled: () => isColorWheelDisabled(state) };
  const rp = renderPropsOf<ColorWheelRenderProps>(merged, { values, defaultClassName: "rv-ColorWheel", defaultStyle: { position: "relative" } });

  const labels = colorWheelInputLabels(opts, state);
  const describedBy = opts["aria-describedby"];
  const details = opts["aria-details"];
  const errorMessage = opts["aria-errormessage"];
  const inputProps = () => ({
    ...labels,
    type: "range",
    ...colorWheelInputRange(state),
    "aria-valuetext": colorWheelInputValueText(opts, state),
    disabled: read(isDisabled) || undefined,
    value: colorWheelInputValue(state),
    name: opts.name,
    form: opts.form,
    onChange: (e: Event) => colorWheelInputChange(e, opts, state),
    onFocus: (e: FocusEvent) => colorWheelInputFocus(e, opts, state),
    "aria-errormessage": errorMessage,
    "aria-describedby": describedBy,
    "aria-details": details,
  });
  const thumbProps = dropHandlers
    ? {}
    : {
        onPointerDown: (e: PointerEvent) => colorWheelThumbPointerDown(e, opts, state),
        onKeyDown: (e: KeyboardEvent) => colorWheelThumbKeyDown(e, opts, state),
      };
  const thumbContext = {
    displayColor: () => getDisplayColor(state),
    isDragging: () => isDragging(state),
    thumbProps,
    thumbStyle: () => colorWheelThumbStyle(opts, state),
    inputXRef: inputRef,
    inputStyle: colorWheelInputStyle,
    xInputProps: inputProps,
    isDisabled,
  };
  const trackContext = dropHandlers
    ? { style: colorWheelTrackStyle(opts) }
    : { style: colorWheelTrackStyle(opts), onPointerDown: (e: PointerEvent) => colorWheelTrackPointerDown(e, opts, state) };

  // `data-disabled` goes through the spread bag (a function attribute value outside a spread is not a server binding,
  // and an explicit attribute after the spread would override the bag's key); none is added while enabled (static).
  const disabledAttr = disabledFlag ?? (isDisabled ? "true" : undefined);
  const dom = disabledAttr ? liveAssign(globalDOMProps(merged, OWNED), { "data-disabled": disabledAttr }) : globalDOMProps(merged, OWNED);
  const slot = merged.slot || undefined;
  const children = rp.children;
  if (merged.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      class: () => rp.class(),
      style: () => rp.style(),
      slot,
      "data-disabled": disabledAttr,
      children: () => (
        <Provider
          values={[
            [ColorWheelStateContext, state],
            [ColorWheelTrackContext, trackContext],
            [InternalColorThumbContext, thumbContext],
          ]}
        >
          {children()}
        </Provider>
      ),
    };
    return merged.render(attrs as never, values);
  }
  return (
    <div {...dom} ref={ref as never} class={rp.class()} style={rp.style()} slot={slot}>
      <Provider
        values={[
          [ColorWheelStateContext, state],
          [ColorWheelTrackContext, trackContext],
          [InternalColorThumbContext, thumbContext],
        ]}
      >
        {children()}
      </Provider>
    </div>
  );
}

export interface ColorWheelTrackRenderProps extends ColorWheelRenderProps {}

export interface ColorWheelTrackProps
  extends
    StyleRenderProps<ColorWheelTrackRenderProps>,
    DOMRenderProps<"div", ColorWheelTrackRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style">,
    SlotProps {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ColorWheelTrack'
   */
  class?: StyleRenderProps<ColorWheelTrackRenderProps>["class"];
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `ColorWheelTrackContext` (the wheel provides the track's handlers + style). */
export const ColorWheelTrackContext = resumableContext(
  createContext<ContextValue<Partial<ColorWheelTrackProps> & Record<string, unknown>, HTMLDivElement>>(null, { id: "rv-color-wheel-track" }),
);

/**
 * A color wheel track is a circular track within a color wheel which displays the hue gradient.
 */
export function ColorWheelTrack(props: ColorWheelTrackProps) {
  const [merged, ref] = contextProps(props, props.ref, ColorWheelTrackContext);
  const state = useContext(ColorWheelStateContext)!;
  const { class: className, style, slot, render, ...rest } = merged as ColorWheelTrackProps & Record<string, unknown>;
  // Live props (P5): `data-disabled` goes through the spread bag (an accessor while the wheel's `isDisabled` is live,
  // `state.disabled`); none is added while enabled.
  const disabledAttr = state.disabled ? liveDisabledAttr(state) : state.isDisabled ? "true" : undefined;
  const attrs = disabledAttr ? { ...rest, "data-disabled": disabledAttr } : rest;
  const values: ColorWheelTrackRenderProps = { isDisabled: () => isColorWheelDisabled(state), state };
  // Live props (P5): a live class / style through one live view per key. No function in the initializer: the spread
  // site captures `rp.class` / `rp.style`, not `rp`.
  const rp = renderProps<ColorWheelTrackRenderProps>(
    { class: className, style, defaultClassName: "rv-ColorWheelTrack", values },
    hasLive(merged) ? (liveRenderProps(merged, ["class", "style"]) as never) : undefined,
  );
  const s = slot ?? undefined;
  if (render) {
    const bag = { ...attrs, slot: s, ref: ref as never, class: () => rp.class(), style: () => rp.style(), "data-disabled": disabledAttr };
    return render(bag as never, values);
  }
  return <div {...attrs} slot={s} ref={ref as never} class={rp.class()} style={rp.style()} />;
}
