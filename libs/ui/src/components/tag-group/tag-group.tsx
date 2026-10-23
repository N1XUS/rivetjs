// Ported from HeroUI v3.2.6 packages/react/src/components/tag-group/tag-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/TagGroup` → `@rivetjs/cdk/tag-group`; `@heroui/styles` →
//   vendored `styles/`.
// - `TagGroupContext` carries plain data `{ inTagGroup, size, variant }` instead of `{ slots, size, variant }` (one module-level
//   slots object: no variants); resumable token `rv-ui-tag-group`, default `{}`. Getter fields when `size` / `variant` are live.
// - `FieldSlotsGate` is not ported (`libs/ui/CLAUDE.md` Known diffs: cdk `Text` hides itself in a collection build pass).
// - Rivet addition (identity spec §4.2, plan T22): auto form — a root with `label`, `description`, `errorMessage` or `items`
//   renders Label + `TagGroup.List` (the children, or a render function of `items`) + Description + ErrorMessage. Children are
//   the list content there (no "children win" rule: same as Select). Decided once at render; the compound form is unchanged.
// - Root `class` is composed into a local string (a plain value for cdk `TagGroup`, which reads a live `class` in place), so a live root `class` is not re-composed; `TagGroup.List` live `class` → render-prop function.
import { TagGroup as TagGroupPrimitive, TagList as TagListPrimitive } from "@rivetjs/cdk/tag-group";
import type { TagGroupProps as TagGroupPrimitiveProps, TagListProps as TagListPrimitiveProps, TagListRenderProps } from "@rivetjs/cdk/tag-group";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { TagVariants } from "../../../styles/src/components/tag/index.ts";
import { tagGroupVariants } from "../../../styles/src/components/tag-group/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { accessorIfLive, hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { ErrorMessageRoot } from "../error-message/error-message.tsx";
import { LabelRoot } from "../label/label.tsx";
import { isSlot } from "@rivetjs/runtime/slot";
import { DEV } from "#dev";

/* -------------------------------------------------------------------------------------------------
 * TagGroup Context
 * -----------------------------------------------------------------------------------------------*/
type TagGroupContext = {
  /** Rivet: set by `TagGroup` (upstream: `slots`). */
  inTagGroup?: boolean;
  size?: TagVariants["size"];
  variant?: TagVariants["variant"];
};

const TagGroupContext = createContext<TagGroupContext>({});

type TagGroupSlots = ReturnType<typeof tagGroupVariants>;
let SLOTS: TagGroupSlots | undefined;
const tagGroupSlots = (): TagGroupSlots => (SLOTS ??= tagGroupVariants());
const slotsOf = (context: TagGroupContext): TagGroupSlots | undefined => (context.inTagGroup ? tagGroupSlots() : undefined);

/* -------------------------------------------------------------------------------------------------
 * TagGroup Root
 * -----------------------------------------------------------------------------------------------*/
type TagGroupRootProps<T extends object = object> = Omit<TagGroupPrimitiveProps, "children"> & {
  size?: TagVariants["size"];
  variant?: TagVariants["variant"];
  /** Auto form: the group's Label (before the list). */
  label?: Content;
  /** Auto form: the group's Description (after the list). */
  description?: Content;
  /** Auto form: the group's ErrorMessage (after the Description). */
  errorMessage?: Content;
} & (
    | { items?: undefined; children?: TagGroupPrimitiveProps["children"] }
    | {
        /** Auto form: the list's items; `children` is then a render function of one item. */
        items: Iterable<T>;
        children?: (item: T) => Content;
      }
  );

const TagGroupRoot = <T extends object = object>(props: TagGroupRootProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as TagGroupRootProps, ["children", "class", "description", "errorMessage", "items", "label", "size", "variant"]);
  // `items` next to compound (slot) children: the children win, `items` is ignored (dev warning). Decided once.
  const compound = local.items !== undefined && isSlot(local.children);
  if (DEV && compound) DEV.itemsIgnored("TagGroup");
  const auto = !compound && (local.label !== undefined || local.description !== undefined || local.errorMessage !== undefined || local.items !== undefined);
  const contextValue: TagGroupContext = hasLiveProp(local, ["size", "variant"])
    ? {
        inTagGroup: true,
        get size() {
          return local.size;
        },
        get variant() {
          return local.variant;
        },
      }
    : { inTagGroup: true, size: local.size, variant: local.variant };
  const content = () => (
    <TagGroupPrimitive class={tagGroupSlots().base({ class: local.class })} data-slot="tag-group" {...(rest as TagGroupPrimitiveProps)}>
      {auto ? (
        <>
          {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
          <TagGroupList items={accessorIfLive(local, "items") as Iterable<object> | undefined}>{local.children as never}</TagGroupList>
          {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
          {local.errorMessage !== undefined && <ErrorMessageRoot>{local.errorMessage}</ErrorMessageRoot>}
        </>
      ) : (
        (local.children as TagGroupPrimitiveProps["children"])
      )}
    </TagGroupPrimitive>
  );

  return (
    <Provider token={TagGroupContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * TagGroup List
 * -----------------------------------------------------------------------------------------------*/
type TagGroupListProps<T extends object = object> = TagListPrimitiveProps<T> & {};

const TagGroupList = <T extends object = object>(props: TagGroupListProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as TagGroupListProps, ["children", "class"]);
  const context = useContext(TagGroupContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.list()) as string | ((v: TagListRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: TagListRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <TagListPrimitive class={cls as never} data-slot="tag-group-list" {...(rest as TagListPrimitiveProps<object>)}>
      {local.children as never}
    </TagListPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { TagGroupRoot, TagGroupList, TagGroupContext };

export type { TagGroupRootProps, TagGroupListProps };
