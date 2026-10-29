// PromptInput queue reordering on a resumed page (`/prompt-input-queue-reorder`; PRO-LAST, Rivet addition with the API
// shape of HeroUI Pro's public PromptInput docs): `#queue` PromptInputQueueReorder.List over a keyed `For` of three rows
// (`#q-1` … `#q-3`), `#queue-order` echoes the stored order; `#queue-x` = the same on `axis="x"`.
import { For } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import { PromptInputQueueReorder } from "@rivetjs/ui/prompt-input-queue-reorder";

interface Queued {
  id: number;
  text: string;
}

export default function QueueReorderStory() {
  const queue = signal<Queued[]>([
    { id: 1, text: "Now add error handling" },
    { id: 2, text: "Then write the tests" },
    { id: 3, text: "Finally update the changelog" },
  ]);
  const chips = signal(["alpha", "beta", "gamma"]);
  return (
    <main class="flex w-[34rem] flex-col gap-6 p-6">
      <PromptInput status="streaming" lockInputOnRun={false}>
        <PromptInput.Queue>
          <PromptInputQueueReorder.List id="queue" values={queue()} onReorder={(next) => queue.set(next)}>
            <For each={queue} by={(q: Queued) => q.id}>
              {(item: () => Queued) => (
                <PromptInputQueueReorder.Item id={`q-${item().id}`} value={item()}>
                  <PromptInput.Queue.Item.Handle />
                  <PromptInput.Queue.Item.Body>
                    <PromptInput.Queue.Item.Content>{item().text}</PromptInput.Queue.Item.Content>
                  </PromptInput.Queue.Item.Body>
                </PromptInputQueueReorder.Item>
              )}
            </For>
          </PromptInputQueueReorder.List>
        </PromptInput.Queue>
        <PromptInput.Shell>
          <PromptInput.Content>
            <PromptInput.TextArea placeholder="Queue another prompt" />
          </PromptInput.Content>
        </PromptInput.Shell>
      </PromptInput>
      <p id="queue-order">
        {queue()
          .map((q) => q.id)
          .join(",")}
      </p>
      <PromptInput.Queue aria-label="Chips">
        <PromptInputQueueReorder.List id="queue-x" axis="x" values={chips()} onReorder={(next) => chips.set(next)}>
          <For each={chips} by={(c: string) => c}>
            {(chip: () => string) => (
              <PromptInputQueueReorder.Item id={`x-${chip()}`} value={chip()} class="w-28 shrink-0">
                <PromptInput.Queue.Item.Content>{chip()}</PromptInput.Queue.Item.Content>
              </PromptInputQueueReorder.Item>
            )}
          </For>
        </PromptInputQueueReorder.List>
      </PromptInput.Queue>
      <p id="queue-x-order">{chips().join(",")}</p>
    </main>
  );
}
