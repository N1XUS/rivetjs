// Ported from HeroUI v3.2.6 packages/react/src/components/color-swatch/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.
import { ColorSwatchRoot } from "./color-swatch.tsx";
import type { ColorSwatchRootProps } from "./color-swatch.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ColorSwatch = Object.assign(ColorSwatchRoot, {
  Root: ColorSwatchRoot,
});

export type ColorSwatch = {
  Props: ColorSwatchRootProps;
  RootProps: ColorSwatchRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ColorSwatchRoot };

export type { ColorSwatchRootProps, ColorSwatchRootProps as ColorSwatchProps } from "./color-swatch.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { colorSwatchVariants } from "../../../styles/src/components/color-swatch/index.ts";

export type { ColorSwatchVariants } from "../../../styles/src/components/color-swatch/index.ts";
