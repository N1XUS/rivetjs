// Ported from HeroUI v3.2.6 packages/react/src/components/toggle-button/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof ToggleButtonRoot>` → `ToggleButtonRootProps`; `@heroui/styles` → vendored `styles/`.
import { ToggleButtonRoot } from "./toggle-button.tsx";
import type { ToggleButtonRootProps } from "./toggle-button.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ToggleButton = Object.assign(ToggleButtonRoot, {
  Root: ToggleButtonRoot,
});

export type ToggleButton = {
  Props: ToggleButtonRootProps;
  RootProps: ToggleButtonRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ToggleButtonRoot };

export type { ToggleButtonRootProps, ToggleButtonRootProps as ToggleButtonProps } from "./toggle-button.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { toggleButtonVariants } from "../../../styles/src/components/toggle-button/index.ts";

export type { ToggleButtonVariants } from "../../../styles/src/components/toggle-button/index.ts";
