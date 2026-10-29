// Rivet-authored EmojiReactionButton demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { EmojiReactionButton } from "@rivetjs/ui/emoji-reaction-button";

export const head = { title: "EmojiReactionButton: Sizes" };

// #region demo
export function Sizes() {
  return (
    <div id="erb-sizes" class="flex items-center gap-2">
      {(["sm", "md", "lg"] as const).map((size) => (
        <EmojiReactionButton size={size} aria-label={`Fire, ${size}`}>
          <EmojiReactionButton.Emoji>🔥</EmojiReactionButton.Emoji>
          <EmojiReactionButton.Count>9</EmojiReactionButton.Count>
        </EmojiReactionButton>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Sizes />
    </div>
  );
}
