// Ported from react-aria-components `Slider`, `SliderOutput`, `SliderTrack`, `SliderFill`, `SliderThumb`
// (packages/react-aria-components/src/Slider.tsx), Apache-2.0, © Adobe.
// A slider allows a user to select one or more values within a range.
// Rivet:
// - composed from parts like RAC: `<Slider><Label/><SliderOutput/><SliderTrack><SliderFill/><SliderThumb/></SliderTrack></Slider>`;
//   the slider provides `SliderStateContext`, `SliderTrackContext` (track bag + `ref()`), `SliderOutputContext`,
//   `LabelContext`.
// - state = `createSliderState` (`./state.ts`: plain signals + JSON); behaviour = `./behaviour.tsx` (`sliderProps`,
//   `sliderThumbProps` + free handlers bound from inline arrows here, so drag / keys resume with no code before the
//   first interaction); `moveProps` from `../interactions/move.tsx`.
// - locale / direction from `useLocale()` (`I18nProvider`); `formatOptions` + locale replace `numberFormatter`.
// - render props are accessors (`isDisabled()`, `orientation()`, `isDragging()`, …); `state` is the state object.
// - the thumb input renders inside a visually hidden `<div>` (RA `VisuallyHidden`).
// `render` (RAC DOMRenderProps) on Slider / SliderOutput / SliderTrack / SliderThumb / SliderFill: given, the attributes go to `render(attrs, <part>RenderProps)` instead of the default element (the thumb's hidden input stays inside `children`). Deviations: `SliderOutput` / fill / thumb style are bindings (no re-render). The label slot:
// RA re-renders with `label: false` when no `<Label>` renders; here the group's `aria-labelledby` follows the slot
// (accessor) while the thumbs keep the label id in theirs.
// - Deviation (user decision 2026-10-08): `snap` prop (default `"release"`): stepped thumbs follow the pointer
//   freely during a drag and animate to the closest step on release (`data-snapping` on SliderThumb /
//   SliderFill; the animation is `@rivetjs/cdk/motion` `Motion1D` driving the position, no CSS transition);
//   `snap="drag"` = RAC behaviour. Thumb and fill position with `getThumbPositionPercent`.
/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { createContext, signal, untrack, useContext } from "@rivetjs/reactivity";
import { ref as createRef } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { useLocale } from "../i18n/index.ts";
import { visuallyHidden } from "../a11y/index.ts";
import { useFocusRing } from "../focus/focus-ring.tsx";
import { hoverProps } from "../interactions/hover.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { moveProps } from "../interactions/move.tsx";
import { clamp } from "../utils/index.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import type { HoverEvents } from "../utils/types.ts";
import { LabelContext } from "../label/index.tsx";
import { hasLive, liveAt, liveOmit, liveOptions, liveView, readOnce } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import {
  Provider,
  contextProps,
  createSlot,
  mergeRefValues,
  renderProps,
  slottedContext,
  type ContextValue,
  type ProviderValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type SlotId,
  type StyleObject,
} from "../slots/index.tsx";
import {
  createSliderState,
  getFormattedValue,
  getThumbMaxValue,
  getThumbMinValue,
  getThumbPositionPercent,
  getValuePercent,
  isSliderDisabled,
  isThumbSnapping,
  sliderOrientation,
  sliderValues,
  type Orientation,
  type SliderState,
} from "./state.ts";
import {
  sliderProps,
  sliderThumbBlur,
  sliderThumbFocus,
  sliderThumbInputChange,
  sliderThumbInputKeyDown,
  sliderThumbInputKeyUp,
  sliderThumbKeyDown,
  sliderThumbMouseDown,
  sliderThumbMove,
  sliderThumbMoveEnd,
  sliderThumbMoveStart,
  sliderThumbPointerDown,
  sliderThumbProps,
  isSliderThumbDisabled,
  sliderThumbTouchStart,
  sliderTrackMouseDown,
  sliderTrackMove,
  sliderTrackMoveEnd,
  sliderTrackMoveStart,
  sliderTrackPointerDown,
  sliderTrackTouchStart,
  type AriaSliderProps,
  type AriaSliderThumbOptions,
  type AriaSliderThumbProps,
} from "./behaviour.tsx";

export * from "./state.ts";
export * from "./behaviour.tsx";

type Bag = Record<string, unknown>;

export interface SliderRenderProps {
  /**
   * The orientation of the slider.
   *
   * @selector [data-orientation="horizontal | vertical"]
   */
  orientation: () => Orientation;
  /**
   * Whether the slider is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /** State of the slider. */
  state: SliderState;
}

export interface SliderProps<T = number | number[]>
  extends
    Omit<AriaSliderProps<T>, "label" | "direction">,
    RenderProps<SliderRenderProps>,
    DOMRenderProps<"div", SliderRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-Slider'
   */
  class?: RenderProps<SliderRenderProps>["class"];
  /** The display format of the value label. */
  formatOptions?: Intl.NumberFormatOptions;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `SliderContext`. */
export const SliderContext = createContext<ContextValue<Partial<SliderProps>, HTMLDivElement>>(null);
/** RAC `SliderStateContext`. */
export const SliderStateContext = createContext<SliderState | null>(null);
/** RAC `SliderTrackContext`. */
export const SliderTrackContext = createContext<ContextValue<Partial<SliderTrackProps> & Bag, HTMLDivElement>>(null);
/** RAC `SliderFillContext`. */
export const SliderFillContext = createContext<ContextValue<Partial<SliderFillProps>, HTMLDivElement>>(null);
/** RAC `SliderOutputContext`. */
export const SliderOutputContext = createContext<ContextValue<Partial<SliderOutputProps> & Bag, HTMLOutputElement>>(null);

const OWNED = ["style", "id", "render"] as const;

// Live props (P5): `data-disabled` goes through the spread bag, so a live `isDisabled` (`state.disabled`) is an
// accessor there and a static one stays a value. Returned arrows = resumable symbols.
function liveDisabledAttr(state: SliderState): () => true | undefined {
  return () => isSliderDisabled(state) || undefined;
}
function disabledAttrs(state: SliderState): Bag {
  return { "data-disabled": state.disabled ? liveDisabledAttr(state) : state.isDisabled || undefined };
}

/** `data-orientation` for a spread / render bag: the slider's orientation, a returned arrow when it is live. */
function orientationOf(state: SliderState): Orientation | (() => Orientation) {
  return state.live?.orientation ? liveOrientationOf(state) : state.orientation;
}
function liveOrientationOf(state: SliderState): () => Orientation {
  return () => sliderOrientation(state);
}

/**
 * A slider allows a user to select one or more values within a range.
 */
export function Slider<T extends number | number[]>(props: SliderProps<T>) {
  const [ctxMerged, ref] = contextProps(props, props.ref, SliderContext as never) as [SliderProps<T>, RefValue<HTMLDivElement> | undefined];
  // Live props (P5, LIVE-SWEEP): `isDisabled`, the range / orientation / format props and `value` (controlled) become
  // accessors at the boundary (the state keeps them: `sliderMin` / `sliderOrientation` / … read them); body reads untracked.
  const merged = hasLive(ctxMerged) ? liveOptions(ctxMerged, LIVE_KEYS as never, ["value"]) : ctxMerged;
  return untrack(() => slider(merged, ref, hasLive(merged)));
}

/** Live by default (LIVE-SWEEP); read once: `id`, `name`, `aria-label` / `aria-labelledby`, `defaultValue`, `snap`, handlers. */
const LIVE_KEYS = ["isDisabled", "minValue", "maxValue", "step", "orientation", "formatOptions"] as const;

function slider<T extends number | number[]>(merged: SliderProps<T>, ref: RefValue<HTMLDivElement> | undefined, live: boolean) {
  const trackRef = createRef<HTMLDivElement>();
  const { locale, direction } = useLocale();
  const state = createSliderState<T>({ ...merged, locale, formatOptions: merged.formatOptions });
  const initialLabel = !merged["aria-label"] && !merged["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  // PROPS-CAPTURE: handlers capture `aria`; component-only keys (children / class / style / ref) stay out of it.
  const { children: _children, class: _class, style: _style, ref: _ref, slot: _slot, render: _render, ...hookProps } = merged as SliderProps<T> & Bag;
  const aria: AriaSliderProps<T> = { ...(hookProps as AriaSliderProps<T>), label: initialLabel, direction };
  const { groupProps, trackProps, labelProps, outputProps } = sliderProps(aria, state);

  // RA re-renders with `label: false` when no Label renders: the group is then labelled by its own props only.
  const labelledBy = groupProps["aria-labelledby"] as string | undefined;
  const ownLabelledBy = merged["aria-labelledby"];
  const group = {
    ...groupProps,
    ...disabledAttrs(state),
    // Inline arrow in the literal (R2-wrapped; an arrow inside a conditional expression is not).
    "aria-labelledby": () => (!initialLabel || hasLabel() ? labelledBy : ownLabelledBy),
  };

  const { moveProps: move } = moveProps({
    onMoveStart: (e) => sliderTrackMoveStart(e, state),
    onMove: (e) => sliderTrackMove(e, aria, state, trackRef() ?? null),
    onMoveEnd: (e) => sliderTrackMoveEnd(e, state),
  });
  const track = mergeProps(
    {
      ...trackProps,
      onMouseDown: (e: MouseEvent) => sliderTrackMouseDown(e, aria, state, e.currentTarget as Element),
      onPointerDown: (e: PointerEvent) => sliderTrackPointerDown(e, aria, state, e.currentTarget as Element),
      onTouchStart: (e: TouchEvent) => sliderTrackTouchStart(e, aria, state, e.currentTarget as Element),
    },
    move,
  );

  const values: SliderRenderProps = { orientation: () => sliderOrientation(state), isDisabled: () => isSliderDisabled(state), state };
  const rp = renderProps<SliderRenderProps>(
    { ...merged, defaultClassName: "rv-Slider", values },
    live ? liveRenderProps<SliderRenderProps>(merged) : undefined,
  );

  const dom = globalDOMProps(merged, OWNED);
  const slot = merged.slot || undefined;
  const orientation = orientationOf(state);
  const providers: ProviderValue<any>[] = [
    [SliderStateContext, state],
    [SliderTrackContext, { ...track, ref: trackRef }],
    [SliderOutputContext, outputProps],
    [LabelContext, { ...labelProps, ref: labelRef }],
  ];
  if (merged.render)
    return merged.render(
      {
        ...dom,
        ...group,
        ref: ref as never,
        class: () => rp.class(),
        style: () => rp.style(),
        slot,
        "data-orientation": orientation,
        children: () => <Provider values={providers}>{rp.children()}</Provider>,
      } as never,
      values,
    );
  return (
    <div {...dom} {...group} ref={ref as never} class={rp.class()} style={rp.style()} slot={slot} data-orientation={sliderOrientation(state)}>
      <Provider values={providers}>{rp.children()}</Provider>
    </div>
  );
}

export interface SliderOutputProps
  extends RenderProps<SliderRenderProps>, DOMRenderProps<"output", SliderRenderProps>, Omit<GlobalDOMAttributes<HTMLOutputElement>, "style"> {
  /** The element's unique identifier (RAC `filterDOMProps` forwards `id`). */
  id?: string;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-SliderOutput'
   */
  class?: RenderProps<SliderRenderProps>["class"];
  ref?: RefValue<HTMLOutputElement>;
}

/**
 * A slider output displays the current value of a slider as text.
 */
export function SliderOutput(props: SliderOutputProps) {
  const [merged, ref] = contextProps(props, props.ref, SliderOutputContext as never) as [SliderOutputProps & Bag, RefValue<HTMLOutputElement> | undefined];
  const state = useContext(SliderStateContext)!;
  const { children, style, class: className, render } = readOnce(merged, ["children", "style", "class", "render"]);
  const rest = liveOmit(merged, ["children", "style", "class", "slot", "render"]) as Bag;
  const liveFrom = hasLive(merged) ? (liveRenderProps(merged) as never) : undefined;
  const values: SliderRenderProps = { orientation: () => sliderOrientation(state), isDisabled: () => isSliderDisabled(state), state };
  const rp = renderProps<SliderRenderProps>({ class: className, style, defaultClassName: "rv-SliderOutput", values }, liveFrom);
  // RAC `defaultChildren: state.getFormattedValue()`: resolved inside the binding so it follows the value.
  const content = (): Content =>
    typeof children === "function" && !isSlot(children)
      ? (children as (v: unknown) => Content)({ ...values, defaultChildren: getFormattedValue(state) })
      : children != null
        ? (renderSlot(children) as Content)
        : getFormattedValue(state);
  const htmlFor = untrack(() => rest.for) as string | (() => string) | undefined;
  const attrs = liveOmit(rest, ["for"]);
  const orientation = orientationOf(state);
  const dis = disabledAttrs(state);
  if (render)
    return render(
      {
        ...attrs,
        ...dis,
        ...({ for: typeof htmlFor === "function" ? htmlFor() : htmlFor } as {}),
        ref: ref as never,
        class: () => rp.class(),
        style: () => rp.style(),
        "data-orientation": orientation || undefined,
        children: () => content(),
      } as never,
      values,
    );
  return (
    <output
      {...attrs}
      {...dis}
      {...({ for: typeof htmlFor === "function" ? htmlFor() : htmlFor } as {})}
      ref={ref as never}
      class={rp.class()}
      style={rp.style()}
      data-orientation={sliderOrientation(state) || undefined}
    >
      {content()}
    </output>
  );
}

export interface SliderTrackRenderProps extends SliderRenderProps {
  /**
   * Whether the slider track is currently hovered with a mouse.
   *
   * @selector [data-hovered]
   */
  isHovered: () => boolean;
}

export interface SliderTrackProps
  extends HoverEvents, RenderProps<SliderTrackRenderProps>, DOMRenderProps<"div", SliderTrackRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The element's unique identifier (RAC `filterDOMProps` forwards `id`). */
  id?: string;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-SliderTrack'
   */
  class?: RenderProps<SliderTrackRenderProps>["class"];
  ref?: RefValue<HTMLDivElement>;
}

/**
 * A slider track is a container for one or more slider thumbs.
 */
export function SliderTrack(props: SliderTrackProps) {
  const [merged, ref] = contextProps(props, props.ref, SliderTrackContext as never) as [SliderTrackProps & Bag, RefValue<HTMLDivElement> | undefined];
  const state = useContext(SliderStateContext)!;
  const {
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    children,
    class: className,
    style,
    render,
  } = readOnce(merged, ["onHoverStart", "onHoverEnd", "onHoverChange", "children", "class", "style", "render"]);
  const rest = liveOmit(merged, ["onHoverStart", "onHoverEnd", "onHoverChange", "children", "class", "style", "slot", "render"]) as Bag;
  const liveFrom = hasLive(merged) ? (liveRenderProps(merged) as never) : undefined;
  const { hoverProps: hover, isHovered } = hoverProps({ onHoverStart, onHoverEnd, onHoverChange }, props);
  const values: SliderTrackRenderProps = { orientation: () => sliderOrientation(state), isDisabled: () => isSliderDisabled(state), isHovered, state };
  const rp = renderProps<SliderTrackRenderProps>({ class: className, style, children, defaultClassName: "rv-SliderTrack", values }, liveFrom);
  const attrs = mergeProps(rest, hover);
  const orientation = orientationOf(state);
  const dis = disabledAttrs(state);
  if (render)
    return render(
      {
        ...attrs,
        ...dis,
        ref: ref as never,
        class: () => rp.class(),
        style: () => rp.style(),
        "data-hovered": () => isHovered() || undefined,
        "data-orientation": orientation || undefined,
        children: () => rp.children(),
      } as never,
      values,
    );
  return (
    <div
      {...attrs}
      {...dis}
      ref={ref as never}
      class={rp.class()}
      style={rp.style()}
      data-hovered={isHovered() || undefined}
      data-orientation={sliderOrientation(state) || undefined}
    >
      {rp.children()}
    </div>
  );
}

export interface SliderThumbRenderProps {
  /** State of the slider. */
  state: SliderState;
  /**
   * Whether this thumb is currently being dragged.
   *
   * @selector [data-dragging]
   */
  isDragging: () => boolean;
  /**
   * Whether the thumb is currently hovered with a mouse.
   *
   * @selector [data-hovered]
   */
  isHovered: () => boolean;
  /**
   * Whether the thumb is currently focused.
   *
   * @selector [data-focused]
   */
  isFocused: () => boolean;
  /**
   * Whether the thumb is keyboard focused.
   *
   * @selector [data-focus-visible]
   */
  isFocusVisible: () => boolean;
  /**
   * Whether the thumb is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Rivet: whether the thumb is animating to its stepped position after a free drag (`snap="release"`).
   *
   * @selector [data-snapping]
   */
  isSnapping: () => boolean;
}

export interface SliderThumbProps
  extends
    Omit<AriaSliderThumbProps, "label" | "validationState" | "direction">,
    HoverEvents,
    RenderProps<SliderThumbRenderProps>,
    DOMRenderProps<"div", SliderThumbRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | "onFocus" | "onBlur" | "onKeyDown" | "onKeyUp"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-SliderThumb'
   */
  class?: RenderProps<SliderThumbRenderProps>["class"];
  /** A ref for the HTML input element. */
  inputRef?: RefValue<HTMLInputElement>;
  ref?: RefValue<HTMLDivElement>;
}

const THUMB_OWNED = ["render", "style", "id", "onPointerDown", "onMouseDown", "onTouchStart", "onKeyDown", "onKeyUp", "onFocus", "onBlur"] as const;

/**
 * A slider thumb represents an individual value that the user can adjust within a slider track.
 */
export function SliderThumb(props: SliderThumbProps) {
  // Live props (P5): body reads are read once (untracked); `isDisabled` / class / children stay live.
  return untrack(() => sliderThumb(props));
}

function thumbDisabledAttr(opts: AriaSliderThumbOptions, state: SliderState): () => true | undefined {
  return () => isSliderThumbDisabled(opts, state) || undefined;
}

function sliderThumb(props: SliderThumbProps) {
  const state = useContext(SliderStateContext)!;
  const trackRef = (slottedContext(SliderTrackContext) as { ref?: () => Element | undefined } | null)?.ref;
  const index = props.index ?? 0;
  const { direction } = useLocale();
  const userInputRef = props.inputRef;
  const inputRef = createRef<HTMLInputElement>();
  const initialLabel = !props["aria-label"] && !props["aria-labelledby"];
  const [labelRef] = createSlot(initialLabel);
  const opts: AriaSliderThumbOptions = {
    index,
    orientation: props.orientation,
    isDisabled: liveAt(liveView(props, ["isDisabled"]), "isDisabled"),
    isRequired: props.isRequired,
    isInvalid: props.isInvalid,
    autoFocus: props.autoFocus,
    name: props.name,
    form: props.form,
    label: initialLabel,
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": props["aria-describedby"],
    "aria-details": props["aria-details"],
    "aria-errormessage": props["aria-errormessage"],
    onFocus: props.onFocus,
    onBlur: props.onBlur,
    onFocusChange: props.onFocusChange,
    onKeyDown: props.onKeyDown,
    onKeyUp: props.onKeyUp,
    direction,
    trackRef: () => trackRef?.() ?? null,
    inputRef: () => inputRef() ?? null,
  };
  const { thumbProps, inputProps, labelProps, isDragging, isFocused, isDisabled } = sliderThumbProps(opts, state);

  const { moveProps: move } = moveProps({
    onMoveStart: (e) => sliderThumbMoveStart(e, opts, state),
    onMove: (e) => sliderThumbMove(e, opts, state),
    onMoveEnd: (e) => sliderThumbMoveEnd(e, opts, state),
  });
  // A live `isDisabled` (own or the slider's) keeps the handlers: they check the current value.
  const live = typeof opts.isDisabled === "function" || !!state.disabled;
  const interactions: Bag =
    live || !isDisabled
      ? mergeProps({ onKeyDown: (e: KeyboardEvent) => sliderThumbKeyDown(e, opts, state) }, move, {
          onMouseDown: (e: MouseEvent) => sliderThumbMouseDown(e, opts, state),
          onPointerDown: (e: PointerEvent) => sliderThumbPointerDown(e, opts, state),
          onTouchStart: (e: TouchEvent) => sliderThumbTouchStart(e, opts, state),
        })
      : {};

  const { focusProps, isFocusVisible } = useFocusRing();
  const { hoverProps: hover, isHovered } = hoverProps(
    { onHoverStart: props.onHoverStart, onHoverEnd: props.onHoverEnd, onHoverChange: props.onHoverChange },
    props,
  );

  const isSnapping = () => isThumbSnapping(state, index);
  const values: SliderThumbRenderProps = {
    state,
    isHovered,
    isDragging,
    isFocused,
    isFocusVisible,
    isDisabled: () => isSliderThumbDisabled(opts, state),
    isSnapping,
  };
  const rp = renderProps<SliderThumbRenderProps>(
    { class: props.class, children: props.children, defaultClassName: "rv-SliderThumb", values },
    hasLive(props) ? (liveRenderProps(props, ["class", "children"]) as never) : undefined,
  );
  const thumbStyle = thumbProps.style as () => StyleObject;
  const ownStyle = props.style;
  const style = () => {
    const defaultStyle = thumbStyle();
    const computed = typeof ownStyle === "function" ? ownStyle({ ...values, defaultStyle }) : ownStyle;
    return { ...defaultStyle, ...computed };
  };

  const dom = globalDOMProps(props, THUMB_OWNED);
  const attrs = mergeProps(dom, interactions, hover, { "data-disabled": live ? thumbDisabledAttr(opts, state) : isDisabled || undefined });
  const {
    min,
    max,
    value,
    "aria-valuetext": valueText,
    "aria-labelledby": inputLabelledBy,
    ...inputStatic
  } = inputProps as Bag & {
    min: () => number;
    max: () => number;
    value: () => number;
    "aria-valuetext": () => string;
    "aria-labelledby"?: string;
  };
  // RA re-renders with `label: false` when no thumb Label renders (useSlot): the input is then labelled by the
  // slider's label (+ its own aria-labelledby) only, never by a thumb label id no element has. Rivet: the thumb
  // label id goes into LabelContext as a slot id that starts unrendered; a `<Label>` consuming it marks it rendered
  // during its render, which on the server precedes the input's spread attribute writes, so SSR markup is right too.
  const thumbLabelId = labelProps.id as string | undefined;
  const thumbLabel: SlotId = { id: thumbLabelId ?? "", rendered: signal<boolean | string>(false) };
  const unlabelledBy = thumbLabelId
    ? inputLabelledBy
        ?.split(" ")
        .filter((part) => part !== thumbLabelId)
        .join(" ") || undefined
    : inputLabelledBy;
  const labelContext = thumbLabelId ? { ...labelProps, id: thumbLabel, ref: labelRef } : { ...labelProps, ref: labelRef };
  const input = mergeProps(inputStatic, focusProps, {
    // Inline arrow in the literal (R2-wrapped; an arrow inside a conditional expression is not).
    "aria-labelledby": () => (thumbLabel.rendered() ? inputLabelledBy : unlabelledBy),
    onFocus: (e: FocusEvent) => sliderThumbFocus(e, opts, state),
    onBlur: (e: FocusEvent) => sliderThumbBlur(e, opts, state),
    onKeyDown: (e: KeyboardEvent) => sliderThumbInputKeyDown(e, opts, state),
    onKeyUp: (e: KeyboardEvent) => sliderThumbInputKeyUp(e, opts, state),
    onInput: (e: Event) => sliderThumbInputChange(e, opts, state),
  });
  const inputRefs = mergeRefValues<HTMLInputElement>(inputRef, userInputRef);
  if (props.render)
    return props.render(
      {
        ...attrs,
        ref: props.ref as never,
        class: () => rp.class(),
        style: () => style(),
        "data-hovered": () => isHovered() || undefined,
        "data-dragging": () => isDragging() || undefined,
        "data-snapping": () => isSnapping() || undefined,
        "data-focused": () => isFocused() || undefined,
        "data-focus-visible": () => isFocusVisible() || undefined,
        children: () => (
          <>
            <div style={visuallyHidden}>
              <input {...input} ref={inputRefs as never} min={min()} max={max()} value={value()} aria-valuetext={valueText()} />
            </div>
            <Provider values={[[LabelContext, labelContext]]}>{rp.children()}</Provider>
          </>
        ),
      } as never,
      values,
    );
  // The thumb's children (its <Label>) render before the input's attributes are written (server: in order).
  const content = <Provider values={[[LabelContext, labelContext]]}>{rp.children()}</Provider>;
  return (
    <div
      {...attrs}
      ref={props.ref as never}
      class={rp.class()}
      style={style()}
      data-hovered={isHovered() || undefined}
      data-dragging={isDragging() || undefined}
      data-snapping={isSnapping() || undefined}
      data-focused={isFocused() || undefined}
      data-focus-visible={isFocusVisible() || undefined}
    >
      <div style={visuallyHidden}>
        <input {...input} ref={inputRefs as never} min={min()} max={max()} value={value()} aria-valuetext={valueText()} />
      </div>
      {content}
    </div>
  );
}

export interface SliderFillRenderProps extends SliderRenderProps {
  /**
   * Whether the slider fill is currently hovered with a mouse.
   *
   * @selector [data-hovered]
   */
  isHovered: () => boolean;
}

export interface SliderFillProps
  extends HoverEvents, RenderProps<SliderFillRenderProps>, DOMRenderProps<"div", SliderFillRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The element's unique identifier (RAC `filterDOMProps` forwards `id`). */
  id?: string;
  /**
   * The value where the fill starts, for a single-thumb slider. Defaults to the minimum value.
   * Ignored for multi-thumb sliders, where the fill spans from the first to the last thumb.
   */
  offset?: number;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-SliderFill'
   */
  class?: RenderProps<SliderFillRenderProps>["class"];
  ref?: RefValue<HTMLDivElement>;
}

/**
 * A slider fill shows the selected range of a slider track.
 */
export function SliderFill(props: SliderFillProps) {
  const [merged, ref] = contextProps(props, props.ref, SliderFillContext as never) as [SliderFillProps & Bag, RefValue<HTMLDivElement> | undefined];
  const state = useContext(SliderStateContext)!;
  const {
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    children,
    class: className,
    style: ownStyle,
    offset,
    render,
  } = readOnce(merged, ["onHoverStart", "onHoverEnd", "onHoverChange", "children", "class", "style", "offset", "render"]);
  const rest = liveOmit(merged, ["onHoverStart", "onHoverEnd", "onHoverChange", "children", "class", "style", "offset", "slot", "render"]) as Bag;
  const liveFrom = hasLive(merged) ? (liveRenderProps(merged) as never) : undefined;
  const { hoverProps: hover, isHovered } = hoverProps({ onHoverStart, onHoverEnd, onHoverChange }, props);
  const values: SliderFillRenderProps = { orientation: () => sliderOrientation(state), isDisabled: () => isSliderDisabled(state), isHovered, state };
  const rp = renderProps<SliderFillRenderProps>({ class: className, children, defaultClassName: "rv-SliderFill", values }, liveFrom);
  // Rivet (snap="release"): any thumb animating to its step after a free drag.
  const isSnapping = () => state.snappings().some(Boolean);
  const style = () => {
    const count = sliderValues(state).length;
    const from = offset != null ? clamp(offset, getThumbMinValue(state, 0), getThumbMaxValue(state, 0)) : getThumbMinValue(state, 0);
    // Rivet: thumb positions (free during a pointer drag with snap="release").
    const start = count > 1 ? getThumbPositionPercent(state, 0) * 100 : getValuePercent(state, from) * 100;
    const end = count > 0 ? getThumbPositionPercent(state, count - 1) * 100 : 0;
    const startPercent = Math.min(start, end);
    const endPercent = Math.max(start, end);
    const vertical = sliderOrientation(state) === "vertical";
    const sizePercent = Math.max(0, endPercent - startPercent);
    const defaultStyle: StyleObject = vertical
      ? { position: "absolute", bottom: `${startPercent}%`, height: `${sizePercent}%`, width: "100%" }
      : { position: "absolute", insetInlineStart: `${startPercent}%`, width: `${sizePercent}%`, height: "100%" };
    const computed = typeof ownStyle === "function" ? ownStyle({ ...values, defaultStyle }) : ownStyle;
    return { ...defaultStyle, ...computed };
  };
  const attrs = mergeProps(rest, hover);
  const orientation = orientationOf(state);
  const dis = disabledAttrs(state);
  if (render)
    return render(
      {
        ...attrs,
        ...dis,
        ref: ref as never,
        class: () => rp.class(),
        style: () => style(),
        "data-hovered": () => isHovered() || undefined,
        "data-snapping": () => isSnapping() || undefined,
        "data-orientation": orientation || undefined,
        children: () => rp.children(),
      } as never,
      values,
    );
  return (
    <div
      {...attrs}
      {...dis}
      ref={ref as never}
      class={rp.class()}
      style={style()}
      data-hovered={isHovered() || undefined}
      data-snapping={isSnapping() || undefined}
      data-orientation={sliderOrientation(state) || undefined}
    >
      {rp.children()}
    </div>
  );
}
