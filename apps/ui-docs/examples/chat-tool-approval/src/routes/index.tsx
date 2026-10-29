// Rivet-authored ChatTool demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { ChatTool } from "@rivetjs/ui/chat-tool";
import type { ChatToolState } from "@rivetjs/ui/chat-tool";

export const head = { title: "ChatTool: Approval" };

// #region demo
export function Approval() {
  const state = signal<ChatToolState>("requires-action");
  // The wrapper gives the demo its own element: a component whose root is a Show is re-created on its first change.
  return (
    <div class="w-[28rem]">
      <Show keyed when={state()}>
        {(current) => (
          <ChatTool
            toolName="deleteFiles"
            triggerPrefix="Tool: "
            state={current()}
            input={{ folder: "/tmp/exports", olderThanDays: 30 }}
            output={{ deleted: 14 }}
            errorText="Rejected by the user."
            defaultExpanded
            onApprove={() => state.set("output-available")}
            onReject={() => state.set("output-error")}
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
      <Approval />
    </div>
  );
}
