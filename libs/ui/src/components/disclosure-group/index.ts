// Ported from HeroUI v3.2.6 packages/react/src/components/disclosure-group/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the root prop type; `@heroui/styles` → vendored `styles/`; the hook module is `.tsx`
// (resumable returned functions).
import { DisclosureGroupRoot } from "./disclosure-group.tsx";
import type { DisclosureGroupRootProps } from "./disclosure-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const DisclosureGroup = Object.assign(DisclosureGroupRoot, {
  Root: DisclosureGroupRoot,
});

export type DisclosureGroup = {
  Props: DisclosureGroupRootProps;
  RootProps: DisclosureGroupRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { DisclosureGroupRoot };

export type { DisclosureGroupRootProps, DisclosureGroupRootProps as DisclosureGroupProps } from "./disclosure-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { disclosureGroupVariants } from "../../../styles/src/components/disclosure-group/index.ts";

export type { DisclosureGroupVariants } from "../../../styles/src/components/disclosure-group/index.ts";

/* -------------------------------------------------------------------------------------------------
 * Hooks
 * -----------------------------------------------------------------------------------------------*/
export { useDisclosureGroupNavigation } from "./use-disclosure-group-navigation.tsx";

export type { UseDisclosureGroupNavigationProps, UseDisclosureGroupNavigationReturn } from "./use-disclosure-group-navigation.tsx";
