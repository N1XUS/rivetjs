// Ported from HeroUI v3.2.6 packages/react/src/components/color-area/color-area.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/ColorArea` → `@rivetjs/cdk/color-area` + `@rivetjs/cdk/color-thumb`
//   (accessor render props); `@heroui/styles` → vendored `styles/`.
// - `ColorAreaContext` carries plain data (`{ inArea, showDots }`, a getter when `showDots` is live; resumable token `rv-ui-color-area`,
//   `{}` default) instead of the tv `slots`; parts look the slots up in a module-level memo per `showDots` (`slotsFor`), `undefined`
//   outside a ColorArea (= upstream `slots?.thumb()`).
// - `value` / `defaultValue` reach the cdk area in their string form (`../../utils/color-value.ts`); a controlled `value` may be a two-way
//   Signal. Live `class` / `showDots` → render-prop class function. The style functions are inline arrows (resumable).
import { ColorArea as ColorAreaPrimitive } from "@rivetjs/cdk/color-area";
import type { ColorAreaProps as ColorAreaPrimitiveProps, ColorAreaRenderProps } from "@rivetjs/cdk/color-area";
import { ColorThumb as ColorThumbPrimitive } from "@rivetjs/cdk/color-thumb";
import type { ColorThumbProps as ColorThumbPrimitiveProps, ColorThumbRenderProps } from "@rivetjs/cdk/color-thumb";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";

import type { ColorAreaVariants } from "../../../styles/src/components/color-area/index.ts";
import { colorAreaVariants } from "../../../styles/src/components/color-area/index.ts";
import { colorProps } from "../../utils/color-value.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

type StyleObject = Record<string, string | number | undefined>;

/* -------------------------------------------------------------------------------------------------
 * ColorArea Context
 * -----------------------------------------------------------------------------------------------*/
interface ColorAreaContext {
  /** Set inside a ColorArea (upstream: `slots`). */
  inArea?: true;
  showDots?: boolean;
}

const ColorAreaContext = resumableContext(createContext<ColorAreaContext>({}, { id: "rv-ui-color-area" }));

type ColorAreaSlots = ReturnType<typeof colorAreaVariants>;

/** Module-level memo per `showDots` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, ColorAreaSlots> = {};
const slotsFor = (showDots: boolean | undefined): ColorAreaSlots => (SLOTS[String(!!showDots)] ??= colorAreaVariants({ showDots }));

/* -------------------------------------------------------------------------------------------------
 * ColorArea Root
 * -----------------------------------------------------------------------------------------------*/
interface ColorAreaRootProps extends ColorAreaPrimitiveProps, ColorAreaVariants {}

const ColorAreaRoot = (props: ColorAreaRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "showDots", "style", "value", "defaultValue"]);
  const isLive = hasLiveProp(local, ["showDots"]);
  const contextValue: ColorAreaContext = isLive
    ? {
        inArea: true,
        get showDots() {
          return local.showDots;
        },
      }
    : { inArea: true, showDots: local.showDots };
  const classOf = () => composeTwRenderProps(local.class as never, slotsFor(local.showDots).base());
  const cls = isLive || hasLiveProp(local, ["class"]) ? (values: ColorAreaRenderProps) => renderClass(classOf(), values) : classOf();
  const style = local.style;
  // A function: Rivet JSX builds nodes eagerly, so the area is created inside the provider.
  const content = () => (
    <ColorAreaPrimitive
      {...(rest as object)}
      {...colorProps(local, ["value", "defaultValue"])}
      class={cls as never}
      data-slot="color-area"
      style={(renderProps: ColorAreaRenderProps & { defaultStyle: StyleObject }) => {
        const userStyle = typeof style === "function" ? (style as (v: unknown) => StyleObject)(renderProps) : style;
        return { "--color-area-background": renderProps.defaultStyle.background, ...(userStyle as StyleObject) };
      }}
    >
      {local.children as Content}
    </ColorAreaPrimitive>
  );

  return (
    <Provider token={ColorAreaContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ColorArea Thumb
 * -----------------------------------------------------------------------------------------------*/
interface ColorAreaThumbProps extends ColorThumbPrimitiveProps {}

const ColorAreaThumb = (props: ColorAreaThumbProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "style"]);
  const context = useContext(ColorAreaContext);
  const classOf = () => composeTwRenderProps(local.class as never, context.inArea ? slotsFor(context.showDots).thumb() : undefined);
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["showDots"]) ? (values: ColorThumbRenderProps) => renderClass(classOf(), values) : classOf();
  const style = local.style;

  return (
    <ColorThumbPrimitive
      class={cls as never}
      data-slot="color-area-thumb"
      style={(renderProps: ColorThumbRenderProps & { defaultStyle: StyleObject }) => {
        const userStyle = typeof style === "function" ? (style as (v: unknown) => StyleObject)(renderProps) : style;
        return { "--color-area-thumb-color": renderProps.defaultStyle.backgroundColor, ...(userStyle as StyleObject) };
      }}
      {...(rest as object)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ColorAreaRoot, ColorAreaThumb };

export type { ColorAreaRootProps, ColorAreaThumbProps };
