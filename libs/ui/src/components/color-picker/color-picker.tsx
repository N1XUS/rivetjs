// Ported from HeroUI v3.2.6 packages/react/src/components/color-picker/color-picker.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{ColorPicker,Button,Popover}` → `@rivetjs/cdk/{color-picker,
//   button,dialog,popover}` (accessor render props); `@heroui/styles` → vendored `styles/`.
// - `ColorPickerContext` carries plain data (`{ inPicker }`, resumable token `rv-ui-color-picker`, `{}` default) instead of the tv
//   `slots`; parts take the slots from one module-level memo (`colorPickerVariants()` has no variants), `undefined` outside a
//   ColorPicker (= upstream `slots?.x`).
// - `value` / `defaultValue` reach the cdk picker in their string form (`../../utils/color-value.ts`); a controlled `value` may be a
//   two-way Signal. Live `class` → render-prop class functions (Trigger / Popover); the root's wrapper `div` binds `class` directly.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { ColorPicker as ColorPickerPrimitive } from "@rivetjs/cdk/color-picker";
import type { ColorPickerProps as ColorPickerPrimitiveProps } from "@rivetjs/cdk/color-picker";
import { DialogTrigger as DialogTriggerPrimitive } from "@rivetjs/cdk/dialog";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ColorPickerVariants } from "../../../styles/src/components/color-picker/index.ts";
import { colorPickerVariants } from "../../../styles/src/components/color-picker/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { colorProps } from "../../utils/color-value.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { SurfaceContext } from "../surface/index.ts";
import { portalTheme } from "../../utils/portal-theme.ts";

/* -------------------------------------------------------------------------------------------------
 * ColorPicker Context
 * -----------------------------------------------------------------------------------------------*/
type ColorPickerContext = {
  /** Rivet: set by `ColorPicker` (upstream: `slots`). */
  inPicker?: boolean;
};

const ColorPickerContext = createContext<ColorPickerContext>({});

type ColorPickerSlots = ReturnType<typeof colorPickerVariants>;
let SLOTS: ColorPickerSlots | undefined;
const rootSlots = (): ColorPickerSlots => (SLOTS ??= colorPickerVariants());
/** Upstream `use(ColorPickerContext).slots`: `colorPickerVariants()` inside a `ColorPicker`, `undefined` outside. */
const slotsOf = (context: ColorPickerContext): ColorPickerSlots | undefined => (context.inPicker ? rootSlots() : undefined);

const ROOT_CONTEXT: ColorPickerContext = { inPicker: true };
const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* -------------------------------------------------------------------------------------------------
 * ColorPicker Root
 * -----------------------------------------------------------------------------------------------*/
interface ColorPickerRootProps extends Omit<ColorPickerPrimitiveProps, "children">, ColorPickerVariants {
  /** Additional class name for the wrapper element */
  class?: string;
  /** Content of the color picker (Trigger, Popover, etc.) */
  children: Content;
}

const ColorPickerRoot = (props: ColorPickerRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "value", "defaultValue"]);
  const content = () => (
    <ColorPickerPrimitive {...(rest as object)} {...colorProps(local, ["value", "defaultValue"])}>
      <DialogTriggerPrimitive>
        <div class={composeSlotClassName(rootSlots().base, local.class)} data-slot="color-picker">
          {local.children}
        </div>
      </DialogTriggerPrimitive>
    </ColorPickerPrimitive>
  );

  return (
    <Provider token={ColorPickerContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ColorPicker Trigger
 * -----------------------------------------------------------------------------------------------*/
interface ColorPickerTriggerProps extends ButtonPrimitiveProps {}

const ColorPickerTrigger = (props: ColorPickerTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ColorPickerContext);
  const trigger = slotsOf(context)?.trigger();
  const classOf = () => composeTwRenderProps(local.class as never, trigger);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive class={cls as never} data-slot="color-picker-trigger" {...(rest as object)}>
      {local.children as Content}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ColorPicker Popover
 * -----------------------------------------------------------------------------------------------*/
interface ColorPickerPopoverProps extends Omit<PopoverPrimitiveProps, "children"> {
  children: Content;
}

const ColorPickerPopover = (props: ColorPickerPopoverProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "placement"]);
  const context = useContext(ColorPickerContext);
  const popover = slotsOf(context)?.popover();
  const classOf = () => composeTwRenderProps(local.class as never, popover) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <PopoverPrimitive {...(rest as object)} class={cls as never} data-slot="color-picker-popover" placement={local.placement ?? "bottom left"}>
      {local.children}
    </PopoverPrimitive>
  );

  return (
    <Provider token={SurfaceContext} value={DEFAULT_SURFACE_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ColorPickerRoot, ColorPickerTrigger, ColorPickerPopover };

export type { ColorPickerRootProps, ColorPickerTriggerProps, ColorPickerPopoverProps };
