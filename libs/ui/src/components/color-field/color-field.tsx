// Ported from HeroUI v3.2.6 packages/react/src/components/color-field/color-field.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/ColorField` → `@rivetjs/cdk/color-field` (accessor render
//   props); `@heroui/styles` → vendored `styles/`; `ColorValue` = the cdk `Color` type.
// - `data-required`: set by the cdk field root itself (RAC sets it too; upstream adds it again from `isRequired`).
// - Children: upstream's `(values) => typeof children === "function" ? children(values) : children` = what the cdk field does with
//   `children` itself (passed through).
// - `value` / `defaultValue` reach the cdk field in their string form (`../../utils/color-value.ts`); a controlled `value` may be a
//   two-way Signal. Live `class` / `fullWidth` → render-prop class function (`hasLiveProp`).
import type { Color } from "@rivetjs/cdk/color";
import { ColorField as ColorFieldPrimitive } from "@rivetjs/cdk/color-field";
import type { ColorFieldProps as ColorFieldPrimitiveProps, ColorFieldRenderProps } from "@rivetjs/cdk/color-field";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ColorFieldVariants } from "../../../styles/src/components/color-field/index.ts";
import { colorFieldVariants } from "../../../styles/src/components/color-field/index.ts";
import { colorProps } from "../../utils/color-value.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * ColorField Root
 * -----------------------------------------------------------------------------------------------*/
interface ColorFieldRootProps extends ColorFieldPrimitiveProps, ColorFieldVariants {}

function ColorFieldRoot(props: ColorFieldRootProps): JSX.Element {
  const [local, rest] = splitLive(props, ["children", "class", "fullWidth", "value", "defaultValue"]);
  const classOf = () => composeTwRenderProps(local.class as never, colorFieldVariants({ fullWidth: local.fullWidth }));
  const cls = hasLiveProp(local, ["class", "fullWidth"]) ? (values: ColorFieldRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ColorFieldPrimitive data-slot="color-field" {...(rest as object)} {...colorProps(local, ["value", "defaultValue"])} class={cls as never}>
      {local.children as Content}
    </ColorFieldPrimitive>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ColorFieldRoot };

export type { ColorFieldRootProps, Color as ColorValue };
