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
  return (
    <span data-slot="streaming-text-run">
      <For each={() => textGraphemes(content())} by={(_character: string, index: number) => index}>
        {(character: () => string) => (
          <span class={characterClass} data-new={untrack(isRevealing) ? "true" : undefined}>
            {character()}
          </span>
        )}
      </For>
    </span>
  );
};
