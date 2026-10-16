// Ported from HeroUI v3.2.6 packages/react/src/components/button-group/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof ButtonGroupX>` → the prop types (`ButtonGroupSeparatorSpanProps` for the generic part);
// `@heroui/styles` → vendored `styles/`.
import type { ButtonGroupRootProps, ButtonGroupSeparatorSpanProps } from "./button-group.tsx";
import { ButtonGroupRoot, ButtonGroupSeparator } from "./button-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ButtonGroup = Object.assign(ButtonGroupRoot, {
  Root: ButtonGroupRoot,
  Separator: ButtonGroupSeparator,
});

export type ButtonGroup = {
  Props: ButtonGroupRootProps;
  RootProps: ButtonGroupRootProps;
  SeparatorProps: ButtonGroupSeparatorSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ButtonGroupRoot, ButtonGroupSeparator };

export type { ButtonGroupRootProps, ButtonGroupRootProps as ButtonGroupProps, ButtonGroupSeparatorProps } from "./button-group.tsx";

export { ButtonGroupContext, BUTTON_GROUP_CHILD } from "./button-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { buttonGroupVariants } from "../../../styles/src/components/button-group/index.ts";

export type { ButtonGroupVariants } from "../../../styles/src/components/button-group/index.ts";
