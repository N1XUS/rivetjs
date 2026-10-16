// Ported from HeroUI v3.2.6 packages/react/src/components/tag/tag.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/TagGroup` → `@rivetjs/cdk/tag-group` (render props are
//   accessors, `allowsRemoving` a boolean); `@heroui/styles` → vendored `styles/`.
// - `TagContext` carries `{ size, variant, customRemove }` instead of `{ slots }` (slots from a module-level memo per
//   `size|variant`); resumable token `rv-ui-tag`, default `{}` → a RemoveButton outside a Tag gets only the caller's `class`.
// - `pickChildren(children, TagRemoveButton)` (moves a custom RemoveButton child after the content) → no children inspection: a
//   custom `Tag.RemoveButton` marks the tag (`customRemove` signal) so the default one is not added, and renders where it is
//   written (upstream: last); it renders nothing while the group does not allow removing (= upstream).
// - `textValue`: a plain string child (Rivet text-only children are strings) or the `textValue` prop; upstream also picks the
//   first string among mixed children (`Children.toArray`), not possible on compiler slots: pass `textValue` there.
// - Function children (`typeof children === "function"`) → `!isSlot(children)`.
// - Live `class` / group `size` / `variant` → render-prop function (the composed class is a local: it reaches cdk `Tag` as a plain value).
import { Tag as TagPrimitive } from "@rivetjs/cdk/tag-group";
import type { TagProps as TagPrimitiveProps, TagRenderProps } from "@rivetjs/cdk/tag-group";
import type { ButtonProps as ButtonPrimitiveProps } from "@rivetjs/cdk/button";
import { createContext, signal, useContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { isSlot } from "@rivetjs/runtime/slot";

import type { TagVariants } from "../../../styles/src/components/tag/index.ts";
import { tagVariants } from "../../../styles/src/components/tag/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { CloseButtonRoot as CloseButton } from "../close-button/close-button.tsx";
import { TagGroupContext } from "../tag-group/tag-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Tag Context
 * -----------------------------------------------------------------------------------------------*/
type TagContext = {
  size?: TagVariants["size"];
  variant?: TagVariants["variant"];
  /** Rivet: set by a custom `Tag.RemoveButton` (upstream: `pickChildren`). */
  customRemove?: Signal<boolean>;
  /** Rivet: the tag's render props (`allowsRemoving`). */
  state?: TagRenderProps;
};

const TagContext = resumableContext(createContext<TagContext>({}, { id: "rv-ui-tag" }));

type TagSlots = ReturnType<typeof tagVariants>;
const SLOTS: Record<string, TagSlots> = {};
const slotsFor = (size: TagVariants["size"], variant: TagVariants["variant"]): TagSlots =>
  (SLOTS[`${size ?? "md"}|${variant ?? "default"}`] ??= tagVariants({ size, variant }));

/* -------------------------------------------------------------------------------------------------
 * Tag Root
 * -----------------------------------------------------------------------------------------------*/
interface TagRootProps extends TagPrimitiveProps, TagVariants {}

const TagRoot = (props: TagRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "size", "variant"]);
  const group = useContext(TagGroupContext);
  // Upstream reads only the group's size / variant (the Tag's own variant props are ignored).
  const classOf = () => composeTwRenderProps(local.class as never, slotsFor(group.size, group.variant).base()) as string | ((v: TagRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(group, ["size", "variant"]) ? (values: TagRenderProps) => renderClass(classOf(), values) : classOf();
  const textValue = typeof local.children === "string" ? local.children : undefined;

  return (
    <TagPrimitive class={cls as never} data-slot="tag" textValue={textValue} {...rest}>
      {(renderProps: TagRenderProps) => {
        const contextValue = {
          get size() {
            return group.size;
          },
          get variant() {
            return group.variant;
          },
          customRemove: signal(false),
          state: renderProps,
        };
        return (
          <Provider token={TagContext} value={contextValue}>
            {typeof local.children === "function" && !isSlot(local.children) ? (
              (local.children as (v: TagRenderProps) => Content)(renderProps)
            ) : (
              <>
                {local.children as Content}
                {() => (renderProps.allowsRemoving && !contextValue.customRemove() ? <TagRemoveDefault /> : null)}
              </>
            )}
          </Provider>
        );
      }}
    </TagPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tag Remove Button
 * -----------------------------------------------------------------------------------------------*/
type TagRemoveButtonProps = ButtonPrimitiveProps & {
  children?: Content;
};

const removeButton = (props: TagRemoveButtonProps, context: TagContext): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const classOf = () =>
    composeTwRenderProps(local.class as never, context.state ? slotsFor(context.size, context.variant).removeButton() : undefined) as string;

  return (
    <CloseButton aria-label="Remove tag" class={classOf()} data-slot="tag-remove-button" slot="remove" {...rest}>
      {local.children}
    </CloseButton>
  );
};

/** Rivet: the default remove button `Tag` adds (does not mark the tag as having a custom one). */
const TagRemoveDefault = (): JSX.Element => removeButton({}, useContext(TagContext));

const TagRemoveButton = (props: TagRemoveButtonProps): JSX.Element => {
  const context = useContext(TagContext);
  context.customRemove?.set(true);
  if (context.state && !context.state.allowsRemoving) return null as unknown as JSX.Element;
  return removeButton(props, context);
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { TagRoot, TagRemoveButton };

export type { TagRootProps, TagRemoveButtonProps };
