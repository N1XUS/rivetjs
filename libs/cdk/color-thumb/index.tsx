// Ported from react-aria-components `ColorThumb` (packages/react-aria-components/src/ColorThumb.tsx), Apache-2.0, © Adobe.
// A color thumb appears within a ColorArea, ColorSlider, or ColorWheel and allows a user to drag to adjust
// the color value. It renders the parent's visually hidden range input(s).
// Rivet:
// - `InternalColorThumbContext` carries accessors instead of per-render values: `displayColor()`,
//   `isDragging()`, `thumbStyle()`, `xInputProps()` / `yInputProps()` (bags of attribute values + R2 handler
//   arrows built by the parent `.tsx`, spread inside a binding), static `thumbProps` handlers, `ref()` input refs.
// - render props are accessors (`isDragging()`, `color()`); `class` / `style` may be functions of them.
// - Rivet addition: `isSnapping()` render prop + `data-snapping` (ColorSlider: the thumb animates to its step after a
//   free drag, `@rivetjs/cdk/slider` `snap="release"`; always false in ColorArea / ColorWheel).
// - hover / focus ring: react-aria useHover on the thumb, useFocusRing on the inputs (signals; nothing runs
//   before the first interaction).
// `render` (RAC DOMRenderProps): given, the attributes object (reactive entries are accessors) goes to `render(attrs, renderProps)` instead of the default element.
import { createContext, useContext, untrack } from "@rivetjs/reactivity";
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import type { Color } from "@rivetjs/cdk/color";
import { useFocusRing } from "../focus/focus-ring.tsx";
import { hoverProps } from "../interactions/hover.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { renderPropsOf, type RefValue, type RenderProps, type StyleObject } from "../slots/index.tsx";
import type { HoverEvents } from "../utils/types.ts";
import { read, type MaybeAccessor } from "../interactions/utils.ts";

/** @internal Value of `InternalColorThumbContext` (provided by ColorArea / ColorSlider / ColorWheel). */
export interface InternalColorThumbContextValue {
  /** `state.getDisplayColor()` (accessor). */
  displayColor: () => Color;
  /** `state.isDragging` (accessor). */
  isDragging: () => boolean;
  /** Rivet: whether the thumb animates to its step after a free drag (ColorSlider; accessor). */
  isSnapping?: () => boolean;
  /** Thumb handlers (static, R2 arrows) + `role`. */
  thumbProps: Record<string, unknown>;
  /** `thumbProps.style` (accessor). */
  thumbStyle: () => StyleObject;
  inputXRef: Ref<HTMLInputElement>;
  inputYRef?: Ref<HTMLInputElement>;
  /** Style of the visually hidden input(s) (a spread cannot carry `style`). */
  inputStyle: StyleObject;
  /** Attributes + handlers of the (x) input (accessor; read inside a spread binding; no `style`). */
  xInputProps: () => Record<string, unknown>;
  yInputProps?: () => Record<string, unknown>;
  /** The parent's `isDisabled`: a value, or an accessor while the parent's prop is live (live props P5). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
}

/** @internal RAC `InternalColorThumbContext`. */
export const InternalColorThumbContext = createContext<InternalColorThumbContextValue | null>(null);

export interface ColorThumbRenderProps {
  /** The selected color, excluding the alpha channel. */
  color: () => Color;
  /**
   * Whether this thumb is currently being dragged.
   *
   * @selector [data-dragging]
   */
  isDragging: () => boolean;
  /**
   * Rivet: whether the thumb is animating to its stepped position after a free drag (ColorSlider `snap="release"`).
   *
   * @selector [data-snapping]
   */
  isSnapping: () => boolean;
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
}

export interface ColorThumbProps
  extends HoverEvents, RenderProps<ColorThumbRenderProps>, DOMRenderProps<"div", ColorThumbRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ColorThumb'
   */
  class?: RenderProps<ColorThumbRenderProps>["class"];
  ref?: RefValue<HTMLDivElement>;
}

/** Global events the thumb handles itself (chained through `mergeProps`). */
const OWNED = ["style", "id", "render"] as const;

/** `data-disabled` of a live parent `isDisabled` (a returned arrow: resumable symbol; goes into the spread bag). */
function liveDisabledAttr(flag: () => boolean | undefined): () => "true" | undefined {
  return () => (flag() ? "true" : undefined);
}

/**
 * A color thumb appears within a ColorArea, ColorSlider, or ColorWheel and allows a user to drag to adjust
 * the color value.
 */
export function ColorThumb(props: ColorThumbProps) {
  const ctx = useContext(InternalColorThumbContext);
  if (!ctx) throw new Error("ColorThumb must be rendered inside a ColorArea, ColorSlider or ColorWheel.");
  const {
    displayColor,
    isDragging,
    isSnapping: snapping,
    thumbProps,
    thumbStyle,
    inputStyle,
    inputXRef,
    inputYRef,
    xInputProps,
    yInputProps,
    isDisabled = false,
  } = ctx;
  const { onHoverStart, onHoverEnd, onHoverChange } = props;
  const { focusProps, isFocused, isFocusVisible } = useFocusRing();
  const { hoverProps: hover, isHovered } = hoverProps({ onHoverStart, onHoverEnd, onHoverChange }, props);

  const values: ColorThumbRenderProps = {
    color: displayColor,
    isHovered,
    isDragging,
    // Rivet: an inline arrow (a destructuring-default arrow is not resume-compiled); ColorArea / ColorWheel give none.
    isSnapping: () => (snapping ? snapping() : false),
    isFocused,
    isFocusVisible,
    isDisabled: () => !!read(isDisabled),
  };
  const rp = untrack(() => renderPropsOf<ColorThumbRenderProps>(props, { defaultClassName: "rv-ColorThumb", values }));
  // RAC defaultStyle = thumbProps.style + backgroundColor: both change while dragging, so resolved per binding run.
  const ownStyle = props.style;
  const style = () => {
    const defaultStyle = { ...thumbStyle(), backgroundColor: displayColor().toString() };
    const computed = typeof ownStyle === "function" ? ownStyle({ ...values, defaultStyle }) : ownStyle;
    return { ...defaultStyle, ...computed };
  };

  const dom = globalDOMProps(props, OWNED);
  // `data-disabled` goes through the spread bag (an accessor while the parent's `isDisabled` is live: a function
  // attribute value outside a spread is not a server binding, and an explicit attribute after the spread would
  // override the bag's key); none is added while enabled.
  const disabledAttr = typeof isDisabled === "function" ? liveDisabledAttr(isDisabled) : isDisabled ? "true" : undefined;
  const merged = disabledAttr ? mergeProps(thumbProps, hover, dom, { "data-disabled": disabledAttr }) : mergeProps(thumbProps, hover, dom);
  const ref = props.ref;
  const children = rp.children;
  if (props.render) {
    const attrs = {
      ...merged,
      ref: ref as never,
      class: () => rp.class(),
      style,
      "data-hovered": () => (isHovered() ? "true" : undefined),
      "data-dragging": () => (isDragging() ? "true" : undefined),
      "data-snapping": () => (values.isSnapping() ? "true" : undefined),
      "data-focused": () => (isFocused() ? "true" : undefined),
      "data-focus-visible": () => (isFocusVisible() ? "true" : undefined),
      "data-disabled": disabledAttr,
      children: () => [
        <input ref={inputXRef} style={inputStyle} {...mergeProps(xInputProps(), focusProps)} />,
        yInputProps && inputYRef ? <input ref={inputYRef} style={inputStyle} {...mergeProps(yInputProps(), focusProps)} /> : null,
        children(),
      ],
    };
    return props.render(attrs as never, values);
  }
  return (
    <div
      {...merged}
      ref={ref as never}
      class={rp.class()}
      style={style()}
      data-hovered={isHovered() ? "true" : undefined}
      data-dragging={isDragging() ? "true" : undefined}
      data-snapping={values.isSnapping() ? "true" : undefined}
      data-focused={isFocused() ? "true" : undefined}
      data-focus-visible={isFocusVisible() ? "true" : undefined}
    >
      <input ref={inputXRef} style={inputStyle} {...mergeProps(xInputProps(), focusProps)} />
      {yInputProps && inputYRef ? <input ref={inputYRef} style={inputStyle} {...mergeProps(yInputProps(), focusProps)} /> : null}
      {children()}
    </div>
  );
}
