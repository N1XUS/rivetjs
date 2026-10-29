// Rivet-authored ChatTool demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { ChatTool } from "@rivetjs/ui/chat-tool";
import type { ChatToolState } from "@rivetjs/ui/chat-tool";

export const head = { title: "ChatTool: Streaming" };

// #region demo
const PARTIAL = '{ "city": "Lis';
const FULL = '{ "city": "Lisbon", "days": 3 }';
const OUTPUT = { forecast: ["22 °C", "24 °C", "21 °C"] };

export function Streaming() {
  const state = signal<ChatToolState>("input-streaming");
  const run = () => {
    state.set("input-streaming");
    setTimeout(() => state.set("input-available"), 600);
    setTimeout(() => state.set("output-available"), 1400);
  };
  return (
    <div class="flex w-[28rem] flex-col items-start gap-3">
      <Button id="tool-run" size="sm" variant="secondary" onPress={() => run()}>
        Run the tool
      </Button>
      <Show keyed when={state()}>
        {(current) => (
          <ChatTool
            class="w-full"
            toolName="getForecast"
            triggerPrefix="Tool: "
            state={current()}
            argsText={current() === "input-streaming" ? PARTIAL : FULL}
            output={OUTPUT}
            defaultExpanded
          />
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
