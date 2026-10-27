// Rivet-authored EmojiReactionButton demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { EmojiReactionButton } from "@rivetjs/ui/emoji-reaction-button";

export const head = { title: "EmojiReactionButton: Read-only" };

// #region demo
export function ReadOnly() {
  return (
    <div id="erb-read-only" class="flex gap-2">
      <EmojiReactionButton isReadOnly isSelected aria-label="Clap, 21 reactions">
        <EmojiReactionButton.Emoji>👏</EmojiReactionButton.Emoji>
        <EmojiReactionButton.Count>21</EmojiReactionButton.Count>
      </EmojiReactionButton>
      <EmojiReactionButton isReadOnly aria-label="Laughing, 6 reactions">
        <EmojiReactionButton.Emoji>😂</EmojiReactionButton.Emoji>
        <EmojiReactionButton.Count>6</EmojiReactionButton.Count>
      </EmojiReactionButton>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ReadOnly />
    </div>
  );
}
