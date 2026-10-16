// Ported from HeroUI v3.2.6 packages/react/src/components/toggle-button-group/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof ToggleButtonGroupX>` → the prop types (`ToggleButtonGroupSeparatorSpanProps` for the generic part);
// `@heroui/styles` → vendored `styles/`.
import type { ToggleButtonGroupRootProps, ToggleButtonGroupSeparatorSpanProps } from "./toggle-button-group.tsx";
import { ToggleButtonGroupRoot, ToggleButtonGroupSeparator } from "./toggle-button-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ToggleButtonGroup = Object.assign(ToggleButtonGroupRoot, {
  Root: ToggleButtonGroupRoot,
  Separator: ToggleButtonGroupSeparator,
});

export type ToggleButtonGroup = {
  Props: ToggleButtonGroupRootProps;
  RootProps: ToggleButtonGroupRootProps;
  SeparatorProps: ToggleButtonGroupSeparatorSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ToggleButtonGroupRoot, ToggleButtonGroupSeparator };

export type {
  ToggleButtonGroupRootProps,
  ToggleButtonGroupRootProps as ToggleButtonGroupProps,
  ToggleButtonGroupSeparatorProps,
} from "./toggle-button-group.tsx";

export { ToggleButtonGroupContext, TOGGLE_BUTTON_GROUP_CHILD } from "./toggle-button-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { toggleButtonGroupVariants } from "../../../styles/src/components/toggle-button-group/index.ts";

export type { ToggleButtonGroupVariants } from "../../../styles/src/components/toggle-button-group/index.ts";
