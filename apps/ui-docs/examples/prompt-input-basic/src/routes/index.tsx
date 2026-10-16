// Rivet-authored PromptInput demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import { Globe, Plus } from "lucide";

export const head = { title: "PromptInput: Usage" };

// #region demo
export function Basic() {
  const sent = signal("");
  return (
    <div class="flex w-[34rem] flex-col gap-3">
      <PromptInput onSubmit={(value) => sent.set(value)}>
        <PromptInput.Shell>
          <PromptInput.Content>
            <PromptInput.TextArea id="pi-text" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarStart>
              <PromptInput.Action aria-label="Add files" tooltip="Add files">
                <Icon icon={Plus} size={16} />
              </PromptInput.Action>
              <PromptInput.Action aria-label="Search the web" tooltip="Search the web">
                <Icon icon={Globe} size={16} />
              </PromptInput.Action>
            </PromptInput.ToolbarStart>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
        <PromptInput.Footer>Answers can be wrong. Check important facts.</PromptInput.Footer>
      </PromptInput>
      <p class="text-sm text-muted">
        Last sent: <span id="pi-sent">{sent() || "nothing yet"}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
