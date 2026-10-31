// Rivet-authored: smoothly paced text, independent of transport chunk boundaries.
import { followText, textGraphemes } from "@rivetjs/cdk/chat/text-reveal";
import { signal, untrack } from "@rivetjs/reactivity";
import { clientEffect, For } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { streamingTextVariants } from "../../../styles/src/components/streaming-text/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = streamingTextVariants();

interface StreamingTextProps extends Omit<JSX.IntrinsicElements["span"], "class" | "children" | "content"> {
  /** Text to display; append to a signal/accessor while generating. Initial text renders in full. */
  content: string | (() => string);
  /** Input is still arriving. Pending letters finish revealing after this turns false. @default false */
  isStreaming?: boolean | (() => boolean);
  /** Graphemes per second, automatically faster for large bursts. 0 displays immediately. @default 80 */
  speed?: number;
  class?: string;
}

const StreamingTextRoot = (props: StreamingTextProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["content", "isStreaming", "speed", "class"]);
  const source = (): string => {
    const value = local.content;
    return typeof value === "function" ? value() : value;
  };
  const streaming = (): boolean => {
    const value = local.isStreaming;
    return (typeof value === "function" ? value() : value) === true;
  };
  const displayed = signal(untrack(source));
  const revealing = signal(false);
  const speed = local.speed;
  clientEffect(() => untrack(() => followText(source, displayed, { isStreaming: streaming, speed, onRevealingChange: (value) => revealing.set(value) })), {
    when: "interaction",
  });
  const characters = (): string[] => {
    // Keep the source dependency: a content write wakes a server-rendered boundary and installs its follower.
    source();
    return textGraphemes(displayed());
  };
  return (
    <span class={composeSlotClassName(SLOTS.base, local.class)} data-slot="streaming-text" data-revealing={() => revealing() || undefined} {...rest}>
      <For each={characters} by={(_character: string, index: number) => index}>
        {(character: () => string) => (
          <span class={SLOTS.character()} data-new={untrack(revealing) ? "true" : undefined}>
            {character()}
          </span>
        )}
      </For>
    </span>
  );
};

export { StreamingTextRoot };
export type { StreamingTextProps };
