// Ported from HeroUI v3.2.6 packages/react/src/components/tag/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import { TagRemoveButton, TagRoot } from "./tag.tsx";
import type { TagRemoveButtonProps, TagRootProps } from "./tag.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Tag = Object.assign(TagRoot, {
  Root: TagRoot,
  RemoveButton: TagRemoveButton,
});

export type Tag = {
  Props: TagRootProps;
  RootProps: TagRootProps;
  RemoveButtonProps: TagRemoveButtonProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { TagRoot, TagRemoveButton };

export type { TagRootProps, TagRemoveButtonProps } from "./tag.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { tagVariants } from "../../../styles/src/components/tag/index.ts";

export type { TagVariants } from "../../../styles/src/components/tag/index.ts";
