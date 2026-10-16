// Ported from HeroUI v3.2.6 packages/react/src/components/color-area/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.
import { ColorAreaRoot, ColorAreaThumb } from "./color-area.tsx";
import type { ColorAreaRootProps, ColorAreaThumbProps } from "./color-area.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ColorArea = Object.assign(ColorAreaRoot, {
  Root: ColorAreaRoot,
  Thumb: ColorAreaThumb,
});

export type ColorArea = {
  Props: ColorAreaRootProps;
  RootProps: ColorAreaRootProps;
  ThumbProps: ColorAreaThumbProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ColorAreaRoot, ColorAreaThumb };

export type { ColorAreaRootProps, ColorAreaRootProps as ColorAreaProps, ColorAreaThumbProps } from "./color-area.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { colorAreaVariants } from "../../../styles/src/components/color-area/index.ts";

export type { ColorAreaVariants } from "../../../styles/src/components/color-area/index.ts";
