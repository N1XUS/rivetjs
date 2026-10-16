// Rivet-authored ChainOfThought demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { ChainOfThought } from "@rivetjs/ui/chain-of-thought";

export const head = { title: "ChainOfThought: Streaming" };

// #region demo
const STEPS = ["Search train times", "Compare ticket prices", "Check the weekend forecast", "Pick the best option"];

export function Streaming() {
  const shown = signal(1);
  const running = signal(false);
  const run = () => {
    if (running()) return;
    shown.set(0);
    running.set(true);
    const tick = () => {
      shown.set(shown() + 1);
      if (shown() < STEPS.length) setTimeout(tick, 500);
      else running.set(false);
    };
    setTimeout(tick, 500);
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
              {(label: () => string) => <ChainOfThought.Step label={label()} />}
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
