// Rivet-authored PromptInput demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import { PromptInputQueueReorder } from "@rivetjs/ui/prompt-input-queue-reorder";

export const head = { title: "PromptInput: Reorder Queue" };

// #region demo
interface Queued {
  id: number;
  text: string;
}

export function ReorderQueue() {
  const queue = signal<Queued[]>([
    { id: 1, text: "Now add error handling" },
    { id: 2, text: "Then write the tests" },
    { id: 3, text: "Finally update the changelog" },
  ]);
  return (
    <div class="flex w-[34rem] max-w-full flex-col gap-3">
      <PromptInput status="streaming" lockInputOnRun={false} onSubmit={(text) => text && queue.set([...queue(), { id: Date.now(), text }])}>
        <PromptInput.Queue>
          <PromptInputQueueReorder.List values={queue()} onReorder={(next) => queue.set(next)}>
            <For each={queue} by={(item: Queued) => item.id}>
              {(item: () => Queued) => (
                <PromptInputQueueReorder.Item value={item()}>
                  <PromptInput.Queue.Item.Handle />
                  <PromptInput.Queue.Item.Body>
                    <PromptInput.Queue.Item.Content>{item().text}</PromptInput.Queue.Item.Content>
                  </PromptInput.Queue.Item.Body>
                  <PromptInput.Queue.Item.Actions>
                    <PromptInput.Queue.Item.Remove onPress={() => queue.set(queue().filter((q) => q.id !== item().id))} />
                  </PromptInput.Queue.Item.Actions>
                </PromptInputQueueReorder.Item>
              )}
            </For>
          </PromptInputQueueReorder.List>
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
      <p class="text-sm text-muted">
        Order:{" "}
        <span id="queue-order">
          {queue()
            .map((q) => q.id)
            .join(", ")}
        </span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ReorderQueue />
    </div>
  );
}
