// Rivet-authored: the common character renderer for StreamingText and live Markdown text.
// Pacing belongs to the caller. Snapshot the animation state when a character row is created so existing letters
// never replay and initial server text never fades in. Keep this renderer internal to the component package.
import { textGraphemes } from "@rivetjs/cdk/chat/text-reveal";
import { untrack } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { streamingTextVariants } from "../../../styles/src/components/streaming-text/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";

const SLOTS = streamingTextVariants();

interface StreamingTextRunProps {
  content: () => string;
  isRevealing: () => boolean;
  /** Optional semantic hook; the character's animation always comes from StreamingText. */
  characterClass?: string;
}

export const StreamingTextRun = (props: StreamingTextRunProps): JSX.Element => {
  const content = props.content;
  const isRevealing = props.isRevealing;
  const characterClass = composeSlotClassName(SLOTS.character, props.characterClass);
  // Appended text re-segments from the second-to-last grapheme only (a stream re-segmenting its whole text per update
  // was O(n²)): grapheme boundaries (UAX #29) depend on the text before them, so an append can only extend the last
  // cluster; one more is kept as margin. Any other change segments the whole text.
  let text = "",
    characters: string[] = [];
  const graphemes = (): string[] => {
    const next = content();
    if (next === text) return characters;
    const count = characters.length;
    let out: string[];
    if (count >= 2 && next.length > text.length && next.slice(0, text.length) === text) {
      const from = text.length - characters[count - 1]!.length - characters[count - 2]!.length;
      out = characters.slice(0, count - 2);
      for (const character of textGraphemes(next.slice(from))) out.push(character);
    } else out = textGraphemes(next);
    text = next;
    characters = out;
    return out;
  };
  return (
    <span data-slot="streaming-text-run">
      <For each={graphemes} by={(_character: string, index: number) => index}>
        {(character: () => string) => (
          <span class={characterClass} data-new={untrack(isRevealing) ? "true" : undefined}>
            {character()}
          </span>
        )}
      </For>
    </span>
  );
};
