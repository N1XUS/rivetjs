// Ported from HeroUI v3.2.6 packages/react/src/components/color-swatch-picker/color-swatch-picker.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/ColorSwatchPicker` → `@rivetjs/cdk/color-swatch-picker` +
//   `@rivetjs/cdk/color-swatch` (accessor render props: `color()`, `isSelected()`); `@heroui/styles` → vendored `styles/`.
// - `ColorSwatchPickerContext` carries plain data (`{ inPicker, layout, size, variant }`, getters when the root's props are live;
//   resumable token `rv-ui-color-swatch-picker`, `{}` default) instead of the tv `slots`; parts look the slots up in a module-level memo
//   per `layout|size|variant` (`slotsFor`), `undefined` outside a ColorSwatchPicker (= upstream `slots?.x`).
// - `ColorSwatchPickerItemContext` (`rv-ui-color-swatch-picker-item`) carries the cdk item render props (accessors).
// - Indicator default content: lucide `Check` (`data-slot="color-swatch-picker-checkmark"`) instead of the inline polyline SVG
//   (icons come from lucide); `data-light-color` is a binding over the item color.
// - `value` / `defaultValue` / item `color` reach the cdk parts in their string form (`../../utils/color-value.ts`); a controlled `value`
//   may be a two-way Signal. Live `class` / variants → render-prop class functions.
import { ColorSwatch as ColorSwatchPrimitive } from "@rivetjs/cdk/color-swatch";
import type { ColorSwatchProps as ColorSwatchPrimitiveProps, ColorSwatchRenderProps } from "@rivetjs/cdk/color-swatch";
import { ColorSwatchPicker as ColorSwatchPickerPrimitive, ColorSwatchPickerItem as ColorSwatchPickerItemPrimitive } from "@rivetjs/cdk/color-swatch-picker";
import type {
  ColorSwatchPickerItemProps as ColorSwatchPickerItemPrimitiveProps,
  ColorSwatchPickerItemRenderProps,
  ColorSwatchPickerProps as ColorSwatchPickerPrimitiveProps,
  ColorSwatchPickerRenderProps,
} from "@rivetjs/cdk/color-swatch-picker";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { isSlot } from "@rivetjs/runtime/slot";
import { Check } from "lucide";

import type { ColorSwatchPickerVariants } from "../../../styles/src/components/color-swatch-picker/index.ts";
import { colorSwatchPickerVariants } from "../../../styles/src/components/color-swatch-picker/index.ts";
import { colorProps } from "../../utils/color-value.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * ColorSwatchPicker Context
 * -----------------------------------------------------------------------------------------------*/
interface ColorSwatchPickerContext {
  /** Set inside a ColorSwatchPicker (upstream: `slots`). */
  inPicker?: true;
  layout?: ColorSwatchPickerVariants["layout"];
  size?: ColorSwatchPickerVariants["size"];
  variant?: ColorSwatchPickerVariants["variant"];
}

const ColorSwatchPickerContext = resumableContext(createContext<ColorSwatchPickerContext>({}, { id: "rv-ui-color-swatch-picker" }));

type ColorSwatchPickerSlots = ReturnType<typeof colorSwatchPickerVariants>;

/** Module-level memo per `layout|size|variant` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, ColorSwatchPickerSlots> = {};
const slotsFor = (
  layout: ColorSwatchPickerVariants["layout"],
  size: ColorSwatchPickerVariants["size"],
  variant: ColorSwatchPickerVariants["variant"],
): ColorSwatchPickerSlots => (SLOTS[`${layout}|${size}|${variant}`] ??= colorSwatchPickerVariants({ layout, size, variant }));

/** Upstream `use(ColorSwatchPickerContext).slots`: `undefined` outside a ColorSwatchPicker. */
const slotsOf = (context: ColorSwatchPickerContext): ColorSwatchPickerSlots | undefined =>
  context.inPicker ? slotsFor(context.layout, context.size, context.variant) : undefined;

/* -------------------------------------------------------------------------------------------------
 * ColorSwatchPickerItem Context
 * -----------------------------------------------------------------------------------------------*/
interface ColorSwatchPickerItemContext {
  state?: ColorSwatchPickerItemRenderProps;
}

const ColorSwatchPickerItemContext = resumableContext(createContext<ColorSwatchPickerItemContext>({}, { id: "rv-ui-color-swatch-picker-item" }));

/* -------------------------------------------------------------------------------------------------
 * ColorSwatchPicker Root
 * -----------------------------------------------------------------------------------------------*/
interface ColorSwatchPickerRootProps extends ColorSwatchPickerPrimitiveProps, ColorSwatchPickerVariants {}

const ColorSwatchPickerRoot = (props: ColorSwatchPickerRootProps): JSX.Element => {
  // `layout` only selects the variant (upstream destructures it: the RAC picker keeps its default `grid`).
  const [local, rest] = splitLive(props, ["children", "class", "layout", "size", "variant", "value", "defaultValue"]);
  const isLive = hasLiveProp(local, ["layout", "size", "variant"]);
  const contextValue: ColorSwatchPickerContext = isLive
    ? {
        inPicker: true,
        get layout() {
          return local.layout;
        },
        get size() {
          return local.size;
        },
        get variant() {
          return local.variant;
        },
      }
    : { inPicker: true, layout: local.layout, size: local.size, variant: local.variant };
  const classOf = () => composeTwRenderProps(local.class as never, slotsFor(local.layout, local.size, local.variant).base());
  const cls = isLive || hasLiveProp(local, ["class"]) ? (values: ColorSwatchPickerRenderProps) => renderClass(classOf(), values) : classOf();
  // A function: Rivet JSX builds nodes eagerly, so the picker is created inside the provider.
  const content = () => (
    <ColorSwatchPickerPrimitive data-slot="color-swatch-picker" {...(rest as object)} {...colorProps(local, ["value", "defaultValue"])} class={cls as never}>
      {local.children as Content}
    </ColorSwatchPickerPrimitive>
  );

  return (
    <Provider token={ColorSwatchPickerContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ColorSwatchPicker Item
 * -----------------------------------------------------------------------------------------------*/
interface ColorSwatchPickerItemProps extends ColorSwatchPickerItemPrimitiveProps {}

const ColorSwatchPickerItem = (props: ColorSwatchPickerItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "color", "style"]);
  const context = useContext(ColorSwatchPickerContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.item());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["layout", "size", "variant"])
      ? (values: ColorSwatchPickerItemRenderProps) => renderClass(classOf(), values)
      : classOf();

  return (
    <ColorSwatchPickerItemPrimitive
      data-slot="color-swatch-picker-item"
      {...(rest as object)}
      {...(colorProps(local, ["color"]) as { color: string })}
      class={cls as never}
      style={(renderProps: ColorSwatchPickerItemRenderProps) => ({ "--color-swatch-current": renderProps.color().toString("css") })}
    >
      {(renderProps: ColorSwatchPickerItemRenderProps) => (
        <Provider token={ColorSwatchPickerItemContext} value={{ state: renderProps }}>
          {typeof local.children === "function" && !isSlot(local.children)
            ? (local.children as (v: ColorSwatchPickerItemRenderProps) => Content)(renderProps)
            : (local.children as Content)}
        </Provider>
      )}
    </ColorSwatchPickerItemPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ColorSwatchPicker Swatch
 * -----------------------------------------------------------------------------------------------*/
interface ColorSwatchPickerSwatchProps extends ColorSwatchPrimitiveProps {}

const ColorSwatchPickerSwatch = (props: ColorSwatchPickerSwatchProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "color"]);
  const context = useContext(ColorSwatchPickerContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.swatch());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["layout", "size", "variant"])
      ? (values: ColorSwatchRenderProps) => renderClass(classOf(), values)
      : classOf();

  return <ColorSwatchPrimitive class={cls as never} data-slot="color-swatch-picker-swatch" {...(rest as object)} {...colorProps(local, ["color"])} />;
};

/* -------------------------------------------------------------------------------------------------
 * ColorSwatchPicker Indicator
 * -----------------------------------------------------------------------------------------------*/
interface ColorSwatchPickerIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content | ((props: ColorSwatchPickerItemRenderProps) => Content);
  class?: string;
}

/** `ColorSwatchPickerIndicator` props for the default element (`span`). */
type ColorSwatchPickerIndicatorSpanProps = ColorSwatchPickerIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof ColorSwatchPickerIndicatorProps>;

/**
 * Calculate relative luminance of a color
 * Uses the formula: L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * Returns a value between 0 (black) and 1 (white)
 */
function getColorLuminance(color: ReturnType<ColorSwatchPickerItemRenderProps["color"]>): number {
  // Get RGB values (0-255 range)
  const r = color.getChannelValue("red");
  const g = color.getChannelValue("green");
  const b = color.getChannelValue("blue");

  // Normalize to 0-1 and calculate luminance
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Upstream is generic over the element (`<E>` + `Omit<JSX.IntrinsicElements[E], …>`): the generic `Omit` is TS2590 at JSX sites (see
// `list-box-item.tsx`), so the part takes the `span` props (`render` must render a `span` anyway).
const ColorSwatchPickerIndicator = (props: ColorSwatchPickerIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ColorSwatchPickerContext);
  const item = useContext(ColorSwatchPickerItemContext);
  const state = item.state;

  const content = () =>
    typeof local.children === "function" && !isSlot(local.children) ? (
      (local.children as (v: ColorSwatchPickerItemRenderProps) => Content)(state ?? ({} as ColorSwatchPickerItemRenderProps))
    ) : local.children ? (
      (local.children as Content)
    ) : (
      <Icon icon={Check} aria-hidden="true" data-slot="color-swatch-picker-checkmark" role="presentation" />
    );

  return (
    <dom.span
      aria-hidden="true"
      class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
      // Determine if the background color is light (luminance > 0.5)
      // Use white checkmark on dark backgrounds, black on light backgrounds
      data-light-color={() => (state?.color && getColorLuminance(state.color()) > 0.5 ? "true" : undefined)}
      data-slot="color-swatch-picker-indicator"
      {...rest}
    >
      {content()}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ColorSwatchPickerRoot, ColorSwatchPickerItem, ColorSwatchPickerSwatch, ColorSwatchPickerIndicator };

export type {
  ColorSwatchPickerRootProps,
  ColorSwatchPickerItemProps,
  ColorSwatchPickerSwatchProps,
  ColorSwatchPickerIndicatorProps,
  ColorSwatchPickerIndicatorSpanProps,
};
