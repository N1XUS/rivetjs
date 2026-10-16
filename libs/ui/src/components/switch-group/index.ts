// Ported from HeroUI v3.2.6 packages/react/src/components/switch-group/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
import { SwitchGroupRoot } from "./switch-group.tsx";
import type { SwitchGroupRootProps } from "./switch-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const SwitchGroup = Object.assign(SwitchGroupRoot, {
  Root: SwitchGroupRoot,
});

export type SwitchGroup = {
  Props: SwitchGroupRootProps;
  RootProps: SwitchGroupRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SwitchGroupRoot };
export type { SwitchGroupRootProps, SwitchGroupRootProps as SwitchGroupProps } from "./switch-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { switchGroupVariants } from "../../../styles/src/components/switch-group/index.ts";

export type { SwitchGroupVariants } from "../../../styles/src/components/switch-group/index.ts";
