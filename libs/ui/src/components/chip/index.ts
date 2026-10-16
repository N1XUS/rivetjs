// Ported from HeroUI v3.2.6 packages/react/src/components/chip/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof ChipX>` → the default-element prop types (`ChipRootSpanProps`, …); `@heroui/styles` → vendored `styles/`.
import type { ChipLabelSpanProps, ChipRootSpanProps } from "./chip.tsx";
import { ChipLabel, ChipRoot } from "./chip.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Chip = Object.assign(ChipRoot, {
  Label: ChipLabel,
  Root: ChipRoot,
});

export type Chip = {
  LabelProps: ChipLabelSpanProps;
  Props: ChipRootSpanProps;
  RootProps: ChipRootSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ChipRoot, ChipLabel };

export type { ChipRootProps, ChipRootProps as ChipProps, ChipLabelProps } from "./chip.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chipVariants } from "../../../styles/src/components/chip/index.ts";

export type { ChipVariants } from "../../../styles/src/components/chip/index.ts";
