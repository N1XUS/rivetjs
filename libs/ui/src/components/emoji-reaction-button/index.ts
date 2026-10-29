// Rivet addition (no HeroUI v3.2.6 counterpart): emoji reaction toggle; feature set inspired by commercial UI kits' public Emoji
// Reaction Button docs, independent implementation (see `emoji-reaction-button.tsx`).
import { EmojiReactionButtonCount, EmojiReactionButtonEmoji, EmojiReactionButtonRoot } from "./emoji-reaction-button.tsx";
import type { EmojiReactionButtonPartProps, EmojiReactionButtonRootProps } from "./emoji-reaction-button.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const EmojiReactionButton = Object.assign(EmojiReactionButtonRoot, {
  Root: EmojiReactionButtonRoot,
  Emoji: EmojiReactionButtonEmoji,
  Count: EmojiReactionButtonCount,
});

export type EmojiReactionButton = {
  Props: EmojiReactionButtonRootProps;
  RootProps: EmojiReactionButtonRootProps;
  PartProps: EmojiReactionButtonPartProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { EmojiReactionButtonRoot, EmojiReactionButtonEmoji, EmojiReactionButtonCount } from "./emoji-reaction-button.tsx";
export type {
  EmojiReactionButtonRootProps,
  EmojiReactionButtonRootProps as EmojiReactionButtonProps,
  EmojiReactionButtonPartProps,
} from "./emoji-reaction-button.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { emojiReactionButtonVariants } from "../../../styles/src/components/emoji-reaction-button/index.ts";

export type { EmojiReactionButtonVariants } from "../../../styles/src/components/emoji-reaction-button/index.ts";
