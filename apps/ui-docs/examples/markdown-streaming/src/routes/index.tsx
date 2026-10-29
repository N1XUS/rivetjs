// Rivet-authored Markdown demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { simulateStream, streamText } from "@rivetjs/cdk/chat";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { Markdown } from "@rivetjs/ui/markdown";
import { TextShimmer } from "@rivetjs/ui/text-shimmer";

export const head = { title: "Markdown: Streaming" };

// #region demo
const REPLY = `Resumable pages skip **hydration**: the server HTML is the app.

- Event handlers load on first use
- Signals update only the nodes that read them

\`\`\`ts
const count = signal(0);
\`\`\`

That is all. Done.`;

export function Streaming() {
  const text = signal("");
  const phase = signal<"idle" | "thinking" | "streaming" | "done">("idle");
  const run = signal(0);
  return (
    <div class="flex w-[32rem] flex-col items-start gap-3">
      <Button
        id="md-stream"
        size="sm"
        variant="secondary"
        isDisabled={() => phase() === "thinking" || phase() === "streaming"}
        onPress={async () => {
          text.set("");
          phase.set("thinking");
          run.set(run() + 1);
          await new Promise((resolve) => setTimeout(resolve, 700));
          phase.set("streaming");
          await streamText(text, simulateStream(REPLY, { interval: 45, wordsPerChunk: 2, jitter: 0.7 }));
          phase.set("done");
        }}
      >
        Stream a reply
      </Button>
      {/* Created in the browser on the first run (keyed by the run): the live Markdown animates its growth. */}
      <Show keyed when={run()}>
        {() => (
          <div class="w-full">
            <Show when={() => phase() === "thinking"}>
              <TextShimmer class="text-sm text-muted">Thinking…</TextShimmer>
            </Show>
            <Markdown id="md-live" class="w-full" content={() => text()} isStreaming={() => phase() === "streaming"} />
          </div>
        )}
      </Show>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Streaming />
    </div>
  );
}
