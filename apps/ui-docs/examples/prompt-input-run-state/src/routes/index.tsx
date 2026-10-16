// Rivet-authored PromptInput demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import type { PromptInputStatus } from "@rivetjs/ui/prompt-input";

export const head = { title: "PromptInput: Run State" };

// #region demo
export function RunState() {
  const status = signal<PromptInputStatus>("ready");
  const timer = signal(0);
  return (
    <div class="flex w-[32rem] flex-col gap-3">
      <PromptInput
        status={() => status()}
        onSubmit={() => {
          status.set("submitted");
          timer.set(
            window.setTimeout(() => {
              status.set("streaming");
              timer.set(window.setTimeout(() => status.set("ready"), 2500));
            }, 600),
          );
        }}
        onStop={() => {
          window.clearTimeout(timer());
          status.set("ready");
        }}
      >
        <PromptInput.Shell>
          <PromptInput.Content>
            <PromptInput.TextArea id="run-text" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send id="run-send" />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
      <p class="text-sm text-muted">
        Status: <output id="run-status">{status()}</output>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RunState />
    </div>
  );
}
