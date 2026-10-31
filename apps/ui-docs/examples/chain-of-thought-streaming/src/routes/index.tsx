// Rivet-authored ChainOfThought demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { ChainOfThought } from "@rivetjs/ui/chain-of-thought";
import { StreamingText } from "@rivetjs/ui/streaming-text";

export const head = { title: "ChainOfThought: Streaming" };

// #region demo
const STEPS = ["Search train times", "Compare ticket prices", "Check the weekend forecast", "Pick the best option"];

export function Streaming() {
  const shown = signal(1);
  const running = signal(false);
  const currentText = signal("");
  const run = async () => {
    if (running()) return;
    shown.set(0);
    currentText.set("");
    running.set(true);
    for (let i = 0; i < STEPS.length; i++) {
      currentText.set("");
      shown.set(i + 1);
      // Mount an empty label first; this models the first chunk of a new agent step arriving.
      await new Promise((resolve) => setTimeout(resolve, 30));
      currentText.set(STEPS[i]!);
      await new Promise((resolve) => setTimeout(resolve, 470));
    }
    running.set(false);
  };
  return (
    <div class="flex w-96 flex-col items-start gap-4">
      <Button id="cot-run" size="sm" variant="secondary" isDisabled={() => running()} onPress={() => run()}>
        Think again
      </Button>
      <ChainOfThought class="w-full" defaultExpanded isStreaming={() => running()}>
        <ChainOfThought.Trigger>{running() ? "Thinking…" : "Thought for 2 seconds"}</ChainOfThought.Trigger>
        <ChainOfThought.Content>
          <ChainOfThought.Steps>
            <For each={() => STEPS.slice(0, shown())} by={(label: string) => label}>
              {(label: () => string, index: () => number) => (
                <ChainOfThought.Step
                  label={() => <StreamingText content={() => (running() && index() === shown() - 1 ? currentText() : label())} isStreaming={() => running()} />}
                />
              )}
            </For>
          </ChainOfThought.Steps>
        </ChainOfThought.Content>
      </ChainOfThought>
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
