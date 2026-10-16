// Ported from HeroUI v3.2.6 packages/react/src/components/tag-group/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import { TagGroupContext, TagGroupList, TagGroupRoot } from "./tag-group.tsx";
import type { TagGroupListProps, TagGroupRootProps } from "./tag-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const TagGroup = Object.assign(TagGroupRoot, {
  Root: TagGroupRoot,
  List: TagGroupList,
});

export type TagGroup<T extends object = object> = {
  Props: TagGroupRootProps<T>;
  RootProps: TagGroupRootProps<T>;
  ListProps: TagGroupListProps<T>;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { TagGroupRoot, TagGroupList, TagGroupContext };

export type { TagGroupRootProps, TagGroupRootProps as TagGroupProps, TagGroupListProps } from "./tag-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { tagGroupVariants } from "../../../styles/src/components/tag-group/index.ts";

export type { TagGroupVariants } from "../../../styles/src/components/tag-group/index.ts";
