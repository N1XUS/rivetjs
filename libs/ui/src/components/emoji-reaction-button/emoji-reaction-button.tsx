// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no emoji reaction button). Feature set inspired by HeroUI Pro's public
// Emoji Reaction Button docs (a pill toggle with an emoji and a count; sizes sm / md / lg; `isReadOnly`; parts `.Emoji`,
// `.Count`); independent implementation, Rivet-authored styles on HeroUI tokens.
// - Root = cdk `ToggleButton` (`aria-pressed`, `data-selected`; `isSelected` value or two-way Signal / `defaultSelected` /
//   `onChange` / `isDisabled`; function `class` / `children` get the accessor render props).
// - `isReadOnly` (read once): the button keeps its selection (controlled by the passed value, `onChange` not called) and
//   carries `data-readonly="true"` (CSS: default cursor, no hover tint, no press scale); it stays focusable for screen readers.
// - Emoji are content (text), not icons: the icon rule applies to UI glyphs, the reaction is the user's data.
import { ToggleButton as ToggleButtonPrimitive } from "@rivetjs/cdk/toggle-button";
import type { ToggleButtonProps as ToggleButtonPrimitiveProps, ToggleButtonRenderProps } from "@rivetjs/cdk/toggle-button";
import type { Signal } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { EmojiReactionButtonVariants } from "../../../styles/src/components/emoji-reaction-button/index.ts";
import { emojiReactionButtonVariants } from "../../../styles/src/components/emoji-reaction-button/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

const SLOTS = emojiReactionButtonVariants();

/* -------------------------------------------------------------------------------------------------
 * EmojiReactionButton Root
 * -----------------------------------------------------------------------------------------------*/
interface EmojiReactionButtonRootProps extends ToggleButtonPrimitiveProps, EmojiReactionButtonVariants {
  /** Whether the button keeps its selection and ignores presses (still focusable). */
  isReadOnly?: boolean;
}

const EmojiReactionButtonRoot = (props: EmojiReactionButtonRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "defaultSelected", "isReadOnly", "isSelected", "onChange", "size"]);
  const classOf = (): string | ((values: ToggleButtonRenderProps) => string) =>
    composeTwRenderProps(local.class as never, emojiReactionButtonVariants({ size: local.size }).base());
  const cls = hasLiveProp(props, ["class", "size"]) ? (values: ToggleButtonRenderProps) => renderClass(classOf(), values) : classOf();
  if (local.isReadOnly) {
    const fixed = local.isSelected as boolean | Signal<boolean> | undefined;
    const selected = () => (typeof fixed === "function" ? fixed() : fixed) ?? local.defaultSelected ?? false;
    return (
      <ToggleButtonPrimitive data-slot="emoji-reaction-button" {...rest} class={cls} data-readonly="true" isSelected={selected()}>
        {local.children}
      </ToggleButtonPrimitive>
    );
  }
  return (
    <ToggleButtonPrimitive
      data-slot="emoji-reaction-button"
      {...rest}
      class={cls}
      defaultSelected={local.defaultSelected}
      isSelected={local.isSelected}
      onChange={local.onChange}
    >
      {local.children}
    </ToggleButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * EmojiReactionButton Emoji / Count
 * -----------------------------------------------------------------------------------------------*/
type EmojiReactionButtonPartProps = Omit<JSX.IntrinsicElements["span"], "class"> & { class?: string };

const EmojiReactionButtonEmoji = (props: EmojiReactionButtonPartProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <span class={composeSlotClassName(SLOTS.emoji, local.class)} data-slot="emoji-reaction-button-emoji" {...rest}>
      {local.children}
    </span>
  );
};

const EmojiReactionButtonCount = (props: EmojiReactionButtonPartProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <span class={composeSlotClassName(SLOTS.count, local.class)} data-slot="emoji-reaction-button-count" {...rest}>
      {local.children}
    </span>
  );
};

export { EmojiReactionButtonRoot, EmojiReactionButtonEmoji, EmojiReactionButtonCount };
export type { EmojiReactionButtonRootProps, EmojiReactionButtonPartProps };
