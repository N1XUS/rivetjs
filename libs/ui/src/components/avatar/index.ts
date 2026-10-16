// Ported from HeroUI v3.2.6 packages/react/src/components/avatar/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof AvatarX>` → the props interfaces (the parts are not generic); `AVATAR_GROUP_CHILD` comes from
// `../avatar-group/avatar-group-context.ts` (as upstream); `@heroui/styles` → vendored `styles/`.
import { AVATAR_GROUP_CHILD } from "../avatar-group/avatar-group-context.ts";
import { AvatarFallback, AvatarImage, AvatarRoot } from "./avatar.tsx";
import type { AvatarFallbackProps, AvatarImageProps, AvatarRootProps } from "./avatar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Avatar = Object.assign(AvatarRoot, {
  Root: AvatarRoot,
  Image: AvatarImage,
  Fallback: AvatarFallback,
});

export type Avatar = {
  Props: AvatarRootProps;
  RootProps: AvatarRootProps;
  ImageProps: AvatarImageProps;
  FallbackProps: AvatarFallbackProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { AvatarRoot, AvatarImage, AvatarFallback };

export type { AvatarRootProps, AvatarRootProps as AvatarProps, AvatarImageProps, AvatarFallbackProps } from "./avatar.tsx";

export { AVATAR_GROUP_CHILD };

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { avatarVariants } from "../../../styles/src/components/avatar/index.ts";

export type { AvatarVariants } from "../../../styles/src/components/avatar/index.ts";
