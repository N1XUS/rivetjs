// Rivet-authored EmojiReactionButton demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { EmojiReactionButton } from "@rivetjs/ui/emoji-reaction-button";

export const head = { title: "EmojiReactionButton: Disabled" };

// #region demo
export function Disabled() {
  return (
    <div id="erb-disabled" class="flex gap-2">
      <EmojiReactionButton isDisabled defaultSelected aria-label="Heart, 8 reactions">
        <EmojiReactionButton.Emoji>❤️</EmojiReactionButton.Emoji>
        <EmojiReactionButton.Count>8</EmojiReactionButton.Count>
      </EmojiReactionButton>
      <EmojiReactionButton isDisabled aria-label="Rocket, 3 reactions">
        <EmojiReactionButton.Emoji>🚀</EmojiReactionButton.Emoji>
        <EmojiReactionButton.Count>3</EmojiReactionButton.Count>
      </EmojiReactionButton>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Disabled />
    </div>
  );
}
