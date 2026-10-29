// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no cell color picker). Feature set inspired by commercial UI kits' public Cell
// Color Picker docs (a settings row: label start, hex value + swatch end, the whole row opens a color picker popover; variants
// default / secondary; parts `.Label`, `.Trigger`, `.ValueDisplay`, `.Swatch`, `.Popover` with `placement` "bottom end"); independent
// implementation, Rivet-authored styles on HeroUI tokens.
// - Root = ui `ColorPicker` (cdk ColorPicker + DialogTrigger: `value` (two-way Signal) / `defaultValue` / `onChange`), class
//   `cell-color-picker`. Context `rv-ui-cell-color-picker` `{ variant }` (plain data; a getter when `variant` is live).
// - `.Trigger` = cdk `Button` (the DialogTrigger's press responder opens the popover) with the cell row classes.
// - `.ValueDisplay` = `span` with the picker color as uppercase hex (cdk `ColorSwatchContext` `{ color }` from the cdk ColorPicker).
// - `.Swatch` = ui `ColorSwatch` (size sm; takes the picker color from the same context); `.Popover` = ui `ColorPicker.Popover`.
// - `isDisabled` on the root disables the trigger (no popover).
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import type { Color } from "@rivetjs/cdk/color";
import { ColorSwatchContext } from "@rivetjs/cdk/color-swatch";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { CellColorPickerVariants } from "../../../styles/src/components/cell-color-picker/index.ts";
import { cellColorPickerVariants } from "../../../styles/src/components/cell-color-picker/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { ColorPickerPopover, ColorPickerRoot } from "../color-picker/color-picker.tsx";
import type { ColorPickerPopoverProps, ColorPickerRootProps } from "../color-picker/color-picker.tsx";
import { ColorSwatchRoot } from "../color-swatch/color-swatch.tsx";
import type { ColorSwatchRootProps } from "../color-swatch/color-swatch.tsx";

interface CellColorPickerContext {
  variant?: CellColorPickerVariants["variant"];
  isDisabled?: boolean;
}

const CellColorPickerContext = createContext<CellColorPickerContext>({});

type Slots = ReturnType<typeof cellColorPickerVariants>;
const SLOTS: Record<string, Slots> = {};
const slotsFor = (variant: CellColorPickerVariants["variant"]): Slots => (SLOTS[String(variant)] ??= cellColorPickerVariants({ variant }));

/* -------------------------------------------------------------------------------------------------
 * CellColorPicker Root
 * -----------------------------------------------------------------------------------------------*/
interface CellColorPickerRootProps extends ColorPickerRootProps, CellColorPickerVariants {
  /** Disable the trigger. */
  isDisabled?: boolean;
}

const CellColorPickerRoot = (props: CellColorPickerRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "variant", "isDisabled"]);
  const value: CellColorPickerContext = {
    get variant() {
      return local.variant;
    },
    get isDisabled() {
      return local.isDisabled;
    },
  };
  // A function: the parts must render inside the provider.
  const content = () => (
    <ColorPickerRoot {...(rest as ColorPickerRootProps)} class={slotsFor(local.variant).base({ class: local.class })}>
      {local.children}
    </ColorPickerRoot>
  );
  return (
    <Provider token={CellColorPickerContext} value={value}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CellColorPicker Trigger
 * -----------------------------------------------------------------------------------------------*/
interface CellColorPickerTriggerProps extends ButtonPrimitiveProps {
  children?: Content;
}

const CellColorPickerTrigger = (props: CellColorPickerTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  const context = useContext(CellColorPickerContext);
  const cls = composeTwRenderProps(local.class as never, slotsFor(context.variant).trigger()) as string | ((values: ButtonRenderProps) => string);
  return (
    <ButtonPrimitive data-slot="cell-color-picker-trigger" isDisabled={context.isDisabled} {...(rest as object)} class={cls as never}>
      {local.children as never}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CellColorPicker Label / ValueDisplay
 * -----------------------------------------------------------------------------------------------*/
type SpanProps = Omit<JSX.IntrinsicElements["span"], "class" | "children"> & { class?: string; children?: Content };

const CellColorPickerLabel = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  const context = useContext(CellColorPickerContext);
  return (
    <span class={composeSlotClassName(slotsFor(context.variant).label, local.class)} data-slot="cell-color-picker-label" {...rest}>
      {local.children}
    </span>
  );
};

const CellColorPickerValueDisplay = (props: Omit<SpanProps, "children">): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(CellColorPickerContext);
  const swatch = useContext(ColorSwatchContext) as { color?: () => Color } | null;
  const hex = () => swatch?.color?.().toString("hex").toUpperCase() ?? "";
  return (
    <span class={composeSlotClassName(slotsFor(context.variant).valueDisplay, local.class)} data-slot="cell-color-picker-value-display" {...rest}>
      {hex()}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CellColorPicker Swatch / Popover
 * -----------------------------------------------------------------------------------------------*/
const CellColorPickerSwatch = (props: ColorSwatchRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "size"]);
  const context = useContext(CellColorPickerContext);
  const cls = composeTwRenderProps(local.class as never, slotsFor(context.variant).swatch());
  return <ColorSwatchRoot data-slot="cell-color-picker-swatch" size={local.size ?? "sm"} {...(rest as object)} class={cls as never} />;
};

const CellColorPickerPopover = (props: ColorPickerPopoverProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "placement", "children"]);
  const context = useContext(CellColorPickerContext);
  return (
    <ColorPickerPopover
      {...(rest as object)}
      class={composeTwRenderProps(local.class as never, slotsFor(context.variant).popover()) as never}
      placement={local.placement ?? "bottom end"}
    >
      {local.children}
    </ColorPickerPopover>
  );
};

export { CellColorPickerRoot, CellColorPickerTrigger, CellColorPickerLabel, CellColorPickerValueDisplay, CellColorPickerSwatch, CellColorPickerPopover };
export type { CellColorPickerRootProps, CellColorPickerTriggerProps, SpanProps as CellColorPickerSpanProps };
