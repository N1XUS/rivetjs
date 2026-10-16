// Rivet-authored PromptInput demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { PromptInput } from "@rivetjs/ui/prompt-input";

export const head = { title: "PromptInput: Queue" };

// #region demo
interface Queued {
  id: number;
  text: string;
  note?: string;
}

export function Queue() {
  const queue = signal<Queued[]>([
    { id: 1, text: "Now add error handling", note: "Runs after the current answer" },
    { id: 2, text: "Then write the tests" },
  ]);
  return (
    <PromptInput class="w-[34rem]" status="streaming" lockInputOnRun={false} onSubmit={(text) => text && queue.set([...queue(), { id: Date.now(), text }])}>
      <PromptInput.Queue>
        <PromptInput.Queue.List>
          <For each={queue} by={(item: Queued) => item.id}>
            {(item: () => Queued) => (
              <PromptInput.Queue.Item>
                <PromptInput.Queue.Item.Icon />
                <PromptInput.Queue.Item.Body>
                  <PromptInput.Queue.Item.Content>{item().text}</PromptInput.Queue.Item.Content>
                  {item().note ? <PromptInput.Queue.Item.Description>{item().note}</PromptInput.Queue.Item.Description> : null}
                </PromptInput.Queue.Item.Body>
                <PromptInput.Queue.Item.Actions>
                  <PromptInput.Queue.Item.Remove onPress={() => queue.set(queue().filter((q) => q.id !== item().id))} />
                </PromptInput.Queue.Item.Actions>
              </PromptInput.Queue.Item>
            )}
          </For>
        </PromptInput.Queue.List>
      </PromptInput.Queue>
      <PromptInput.Shell>
        <PromptInput.Content>
          <PromptInput.TextArea placeholder="Queue another prompt" />
        </PromptInput.Content>
        <PromptInput.Toolbar>
          <PromptInput.ToolbarEnd>
            <PromptInput.Send />
          </PromptInput.ToolbarEnd>
        </PromptInput.Toolbar>
      </PromptInput.Shell>
    </PromptInput>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Queue />
    </div>
  );
}
