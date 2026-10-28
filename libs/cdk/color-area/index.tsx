// Ported from react-aria-components `ColorArea` (packages/react-aria-components/src/ColorArea.tsx), Apache-2.0, © Adobe.
// A color area allows users to adjust two channels of an RGB, HSL or HSB color value against a two-dimensional
// gradient background. Children: `<ColorThumb />`.
// Rivet:
// - state = `createColorAreaState` (`@rivetjs/cdk/color`: plain signals + JSON); `value` = plain value or
//   two-way Signal (string | Color); the hook-local state = `createColorAreaInteraction()`; refs = `ref()`.
// - handlers are inline arrows over the `./behaviour.tsx` free functions (resumable: drag / keys work on a
//   resumed page); the gradient background is an inline style from JS (`colorAreaStyle`).
// - render props are accessors (`isDisabled()`); `state` is the serializable state object.
// `render` (RAC DOMRenderProps): given, the attributes object (reactive entries are accessors) goes to `render(attrs, renderProps)` instead of the default element.
import { ColorAreaContext, ColorAreaStateContext } from "./contexts.ts";
import { ref as createRef } from "@rivetjs/runtime/dom";
import { createColorAreaState, getColorAreaDisplayColor, type ColorAreaState } from "../color/area-state.ts";
import { useLocale } from "@rivetjs/cdk/i18n";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { Provider, mergeRefValues, contextProps, renderPropsOf, type RefValue, type RenderProps, type SlotProps } from "../slots/index.tsx";
import { InternalColorThumbContext } from "../color-thumb/index.tsx";
import {
  colorAreaGroupLabels,
  colorAreaInputChange,
  colorAreaInputFocus,
  colorAreaInputHidden,
  colorAreaInputLabels,
  colorAreaInputRange,
  colorAreaInputStyle,
  colorAreaInputTabIndex,
  colorAreaInputValue,
  colorAreaInputValueText,
  colorAreaPointerDown,
  colorAreaRoleDescription,
  colorAreaStyle,
  colorAreaThumbFocusIn,
  colorAreaThumbFocusOut,
  colorAreaThumbKeyDown,
  COLOR_AREA_KEYS,
  colorAreaThumbPointerDown,
  colorAreaThumbStyle,
  createColorAreaInteraction,
  type AriaColorAreaOptions,
  type AriaColorAreaProps,
} from "./behaviour.tsx";
import { liveAssign, liveOptions } from "../utils/live.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { isColorAreaDisabled } from "../color/area-state.ts";

export * from "./behaviour.tsx";

export interface ColorAreaRenderProps {
  /**
   * Whether the color area is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /** State of the color area. */
  state: ColorAreaState;
}

export interface ColorAreaProps
  extends
    AriaColorAreaProps,
    RenderProps<ColorAreaRenderProps>,
    DOMRenderProps<"div", ColorAreaRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ColorArea'
   */
  class?: RenderProps<ColorAreaRenderProps>["class"];
  ref?: RefValue<HTMLDivElement>;
}

const OWNED = ["style", "id", "onPointerDown", "render"] as const;

/** `data-disabled` of a live `isDisabled` (a returned arrow: resumable symbol; goes into the spread bag). */
function liveDisabledAttr(state: ColorAreaState): () => "true" | undefined {
  return () => (isColorAreaDisabled(state) ? "true" : undefined);
}

/**
 * A color area allows users to adjust two channels of an RGB, HSL or HSB color value against a
 * two-dimensional gradient background.
 */
export function ColorArea(props: ColorAreaProps) {
  // SELECT-B: the body stays in the component (no lowercase helper): the build's boundary facts see only a
  // component's own body, so its handlers / keyed state make an instance with no stateful caller a boundary.
  const [ctxMerged, forwarded] = contextProps(props, props.ref, ColorAreaContext);
  // Live props (P5): `isDisabled` and a controlled `value={c()}` become accessors (the state / handlers read them; the
  // value is never written); the rest of the body is read once (untracked: a prop change never re-creates the area).
  const merged = liveOptions(ctxMerged, ["isDisabled"], ["value"]);
  const inputXRef = createRef<HTMLInputElement>();
  const inputYRef = createRef<HTMLInputElement>();
  const containerRef = createRef<HTMLDivElement>();
  const { locale, direction } = useLocale();
  const state = createColorAreaState(merged);
  // A live `isDisabled` is an accessor: the handlers stay attached and check it at event time.
  const isDisabled = merged.isDisabled as MaybeAccessor<boolean | undefined>;
  const disabledFlag = state.disabled ? liveDisabledAttr(state) : undefined;
  const dropHandlers = !disabledFlag && !!isDisabled;
  const opts: AriaColorAreaOptions = {
    isDisabled,
    id: merged.id,
    "aria-label": merged["aria-label"],
    "aria-labelledby": merged["aria-labelledby"],
    "aria-describedby": merged["aria-describedby"],
    "aria-details": merged["aria-details"],
    xName: merged.xName,
    yName: merged.yName,
    form: merged.form,
    inputXRef,
    inputYRef,
    containerRef,
    locale,
    direction,
    interaction: createColorAreaInteraction(),
  };

  const values: ColorAreaRenderProps = { state, isDisabled: () => isColorAreaDisabled(state) };
  const rp = renderPropsOf<ColorAreaRenderProps>(merged, { defaultClassName: "rv-ColorArea", values });
  const ownStyle = merged.style;
  const style = () => {
    const defaultStyle = colorAreaStyle(opts, state);
    const computed = typeof ownStyle === "function" ? ownStyle({ state, isDisabled: () => isColorAreaDisabled(state), defaultStyle }) : ownStyle;
    return { ...defaultStyle, ...computed };
  };

  const roledescription = colorAreaRoleDescription(opts);
  const xLabels = colorAreaInputLabels(opts);
  const yLabels = colorAreaInputLabels(opts);
  const describedBy = opts["aria-describedby"];
  const details = opts["aria-details"];
  const xInputProps = () => ({
    ...xLabels,
    onFocus: (e: FocusEvent) => colorAreaInputFocus(e, opts, state, "x"),
    type: "range",
    ...colorAreaInputRange(opts, state, "x"),
    "aria-roledescription": roledescription,
    "aria-valuetext": colorAreaInputValueText(opts, state, "x"),
    "aria-orientation": "horizontal",
    "aria-describedby": describedBy,
    "aria-details": details,
    disabled: read(isDisabled) || undefined,
    value: colorAreaInputValue(state, "x"),
    name: opts.xName,
    form: opts.form,
    tabIndex: colorAreaInputTabIndex(opts, "x"),
    "aria-hidden": colorAreaInputHidden(opts, "x"),
    onChange: (e: Event) => colorAreaInputChange(e, opts, state),
  });
  const yInputProps = () => ({
    ...yLabels,
    onFocus: (e: FocusEvent) => colorAreaInputFocus(e, opts, state, "y"),
    type: "range",
    ...colorAreaInputRange(opts, state, "y"),
    "aria-roledescription": roledescription,
    "aria-valuetext": colorAreaInputValueText(opts, state, "y"),
    "aria-orientation": "vertical",
    "aria-describedby": describedBy,
    "aria-details": details,
    disabled: read(isDisabled) || undefined,
    value: colorAreaInputValue(state, "y"),
    name: opts.yName,
    form: opts.form,
    tabIndex: colorAreaInputTabIndex(opts, "y"),
    "aria-hidden": colorAreaInputHidden(opts, "y"),
    onChange: (e: Event) => colorAreaInputChange(e, opts, state),
  });
  const thumbProps = dropHandlers
    ? { role: "presentation" }
    : {
        role: "presentation",
        // Rivet: the keys `colorAreaThumbKeyDown` handles — held by the resume loader while the chunk loads (a cold key
        // must not step the native range inputs).
        "data-rk": COLOR_AREA_KEYS,
        onPointerDown: (e: PointerEvent) => colorAreaThumbPointerDown(e, opts, state),
        onKeyDown: (e: KeyboardEvent) => colorAreaThumbKeyDown(e, opts, state),
        onFocusIn: (e: FocusEvent) => colorAreaThumbFocusIn(e, opts),
        onFocusOut: (e: FocusEvent) => colorAreaThumbFocusOut(e, opts),
      };
  const thumbContext = {
    displayColor: () => getColorAreaDisplayColor(state),
    isDragging: () => state.dragging(),
    thumbProps,
    thumbStyle: () => colorAreaThumbStyle(opts, state),
    inputXRef,
    inputYRef,
    inputStyle: colorAreaInputStyle,
    xInputProps,
    yInputProps,
    isDisabled,
  };

  const groupLabels = colorAreaGroupLabels(opts);
  // `data-disabled` goes through the spread bag (a function attribute value outside a spread is not a server binding,
  // and an explicit attribute after the spread would override the bag's key); none is added while enabled (static).
  const disabledAttr = disabledFlag ?? (isDisabled ? "true" : undefined);
  const dom = disabledAttr ? liveAssign(globalDOMProps(merged, OWNED), { "data-disabled": disabledAttr }) : globalDOMProps(merged, OWNED);
  const { onPointerDown } = merged;
  const slot = merged.slot || undefined;
  // The container ref (RA `containerRef`) doubles as the forwarded ref.
  const ref = mergeRefValues(containerRef, forwarded);
  const children = rp.children;
  if (merged.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      id: groupLabels.id,
      "aria-label": groupLabels["aria-label"],
      "aria-labelledby": groupLabels["aria-labelledby"],
      role: "group",
      class: () => rp.class(),
      style,
      slot,
      "data-disabled": disabledAttr,
      onPointerDown: (e: PointerEvent) => {
        colorAreaPointerDown(e as never, opts, state);
        onPointerDown?.(e as never);
      },
      children: () => (
        <Provider
          values={[
            [ColorAreaStateContext, state],
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
    <div
      {...dom}
      ref={ref as never}
      id={groupLabels.id}
      aria-label={groupLabels["aria-label"]}
      aria-labelledby={groupLabels["aria-labelledby"]}
      role="group"
      class={rp.class()}
      style={style()}
      slot={slot}
      onPointerDown={(e) => {
        colorAreaPointerDown(e, opts, state);
        onPointerDown?.(e);
      }}
    >
      <Provider
        values={[
          [ColorAreaStateContext, state],
          [InternalColorThumbContext, thumbContext],
        ]}
      >
        {children()}
      </Provider>
    </div>
  );
}

export { ColorAreaContext, ColorAreaStateContext };
