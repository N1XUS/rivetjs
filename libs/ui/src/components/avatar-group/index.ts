// Ported from HeroUI v3.2.6 packages/react/src/components/avatar-group/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof AvatarGroupRoot>` → `AvatarGroupRootDivProps` (generic root), `CountProps` → `AvatarGroupCountProps`;
// `@heroui/styles` → vendored `styles/`. `AvatarGroupContextValue` stays a type of `./avatar-group.tsx` (upstream's index exports
// neither the type nor the Rivet-only registration fields).
import type { AvatarGroupCountProps, AvatarGroupRootDivProps } from "./avatar-group.tsx";
import { AvatarGroupCount, AvatarGroupRoot } from "./avatar-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const AvatarGroup = Object.assign(AvatarGroupRoot, {
  Root: AvatarGroupRoot,
  Count: AvatarGroupCount,
});

export type AvatarGroup = {
  Props: AvatarGroupRootDivProps;
  RootProps: AvatarGroupRootDivProps;
  CountProps: AvatarGroupCountProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { AvatarGroupRoot, AvatarGroupCount };

export type { AvatarGroupRootProps, AvatarGroupRootProps as AvatarGroupProps, AvatarGroupCountProps } from "./avatar-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/
export { AvatarGroupContext, AVATAR_GROUP_CHILD } from "./avatar-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { avatarGroupVariants } from "../../../styles/src/components/avatar-group/index.ts";

export type { AvatarGroupVariants } from "../../../styles/src/components/avatar-group/index.ts";
