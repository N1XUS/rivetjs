// Ported from HeroUI v3.2.6 packages/react/src/components/avatar-group/avatar-group-context.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; React context → `resumableContext(createContext(…, { id: "rv-ui-avatar-group" }))`, default `{}`.
// - Data `{ size, color, variant }` + Rivet-only `isGrid` / `overlap` (the `Count` slot class from a module-level memo) instead of the
//   tv `slots` (functions do not serialize on resume); fields are getters over the group's live props.
// - Child registration (Rivet-only, replaces upstream's `Children.toArray` partition + `cloneElement`): every Avatar under the
//   group calls `register()` (its creation order = its index) and renders while `isVisible(id)` (`max`); an explicit
//   `AvatarGroup.Count` calls `registerCount()` (suppresses the automatic `+N`). Compiler-registered inline functions of the group
//   body (resumable: their captures are the group's signals and live props).
import { createContext } from "@rivetjs/reactivity";
import { resumableContext } from "@rivetjs/runtime/resume-format";

import type { AvatarVariants } from "../../../styles/src/components/avatar/index.ts";
import type { AvatarGroupVariants } from "../../../styles/src/components/avatar-group/index.ts";

/* -------------------------------------------------------------------------------------------------
 * AvatarGroup Context
 * -----------------------------------------------------------------------------------------------*/
type AvatarGroupContextValue = {
  size?: AvatarVariants["size"];
  color?: AvatarVariants["color"];
  variant?: AvatarVariants["variant"];
  isGrid?: AvatarGroupVariants["isGrid"];
  overlap?: AvatarGroupVariants["overlap"];
  /** @internal Registers an Avatar child; returns its id (creation order). Rivet-only (no children clone), not public API. */
  register?: () => number;
  /** @internal Whether the Avatar with this id is within `max` (always `true` without `max`). */
  isVisible?: (id: number) => boolean;
  /** @internal Registers an explicit `AvatarGroup.Count` (no automatic `+N` then). */
  registerCount?: () => void;
};

const AvatarGroupContext = resumableContext(createContext<AvatarGroupContextValue>({}, { id: "rv-ui-avatar-group" }));

/** Marks direct children of AvatarGroup so nested Avatars do not inherit group props. */
const AVATAR_GROUP_CHILD = "__avatar_group_child";

export { AvatarGroupContext, AVATAR_GROUP_CHILD };
export type { AvatarGroupContextValue };
