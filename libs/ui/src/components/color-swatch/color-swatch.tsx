// Ported from HeroUI v3.2.6 packages/react/src/components/color-swatch/color-swatch.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/ColorSwatch` → `@rivetjs/cdk/color-swatch` (accessor render
//   props: `color()`); `@heroui/styles` → vendored `styles/`.
// - `color` reaches the cdk swatch in its string form (`../../utils/color-value.ts`: Color instances are not serializable resume
//   captures); an accessor / signal passes through. Live `class` / `shape` / `size` → render-prop class function (`hasLiveProp`).
import { ColorSwatch as ColorSwatchPrimitive } from "@rivetjs/cdk/color-swatch";
import type { ColorSwatchProps as ColorSwatchPrimitiveProps, ColorSwatchRenderProps } from "@rivetjs/cdk/color-swatch";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ColorSwatchVariants } from "../../../styles/src/components/color-swatch/index.ts";
import { colorSwatchVariants } from "../../../styles/src/components/color-swatch/index.ts";
import { colorProps } from "../../utils/color-value.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

type StyleObject = Record<string, string | number | undefined>;

/* -------------------------------------------------------------------------------------------------
 * ColorSwatch Root
 * -----------------------------------------------------------------------------------------------*/
interface ColorSwatchRootProps extends ColorSwatchPrimitiveProps, ColorSwatchVariants {}

const ColorSwatchRoot = (props: ColorSwatchRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "shape", "size", "style", "color"]);
  const classOf = () => composeTwRenderProps(local.class as never, colorSwatchVariants({ shape: local.shape, size: local.size }));
  const cls = hasLiveProp(local, ["class", "shape", "size"]) ? (values: ColorSwatchRenderProps) => renderClass(classOf(), values) : classOf();
  const style = local.style;

  return (
    <ColorSwatchPrimitive
      {...(rest as object)}
      {...colorProps(local, ["color"])}
      class={cls as never}
      data-slot="color-swatch"
      style={(renderProps: ColorSwatchRenderProps & { defaultStyle: StyleObject }) => {
        const userStyle = typeof style === "function" ? (style as (v: unknown) => StyleObject)(renderProps) : style;
        return { "--color-swatch-current": renderProps.color().toString("css"), ...(userStyle as StyleObject) };
      }}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ColorSwatchRoot };

export type { ColorSwatchRootProps };
