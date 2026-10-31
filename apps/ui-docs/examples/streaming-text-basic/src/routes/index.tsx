// Rivet-authored: deliberately bursty input, paced into a continuous character reveal.
import { simulateStream, streamText } from "@rivetjs/cdk/chat";
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { StreamingText } from "@rivetjs/ui/streaming-text";

export const head = { title: "StreamingText: Usage" };

// #region demo
const REPLY =
  "Text should arrive like a thought taking shape. Even when several words arrive together, each letter flows into the next.\n\nNew paragraphs stay in the natural document flow. Emoji stay together, too: 👩🏽‍💻.";

export function Streaming() {
  const text = signal("");
  const running = signal(false);
  return (
    <div class="flex w-[32rem] max-w-full flex-col items-start gap-4">
      <Button
        id="text-stream"
        size="sm"
        variant="secondary"
        isDisabled={running}
        onPress={async () => {
          text.set("");
          running.set(true);
          await streamText(text, simulateStream(REPLY, { interval: 180, wordsPerChunk: 4, jitter: 0.6 }));
          running.set(false);
        }}
      >
        Stream text
      </Button>
      <div class="min-h-32 w-full text-sm leading-relaxed">
        <StreamingText id="text-live" content={text} isStreaming={running} />
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Streaming />
    </div>
  );
}
