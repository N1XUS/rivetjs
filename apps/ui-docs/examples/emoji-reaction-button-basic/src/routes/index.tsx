// Rivet-authored EmojiReactionButton demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { EmojiReactionButton } from "@rivetjs/ui/emoji-reaction-button";

export const head = { title: "EmojiReactionButton: Usage" };

// #region demo
const REACTIONS = [
  { emoji: "👍", label: "Thumbs up", count: 12, mine: true },
  { emoji: "🎉", label: "Party", count: 4, mine: false },
  { emoji: "👀", label: "Eyes", count: 2, mine: false },
];

function Reaction(props: { emoji: string; label: string; count: number; mine: boolean }) {
  const selected = signal(props.mine);
  const count = () => props.count - (props.mine ? 1 : 0) + (selected() ? 1 : 0);
  return (
    <EmojiReactionButton isSelected={selected} aria-label={`${props.label}, ${count()} reactions`}>
      <EmojiReactionButton.Emoji>{props.emoji}</EmojiReactionButton.Emoji>
      <EmojiReactionButton.Count>{count}</EmojiReactionButton.Count>
    </EmojiReactionButton>
  );
}

export function Basic() {
  return (
    <div id="erb-basic" class="flex flex-wrap gap-2">
      {REACTIONS.map((reaction) => (
        <Reaction {...reaction} />
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
