// Rivet-authored PromptInput demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import { PromptSuggestion } from "@rivetjs/ui/prompt-suggestion";

export const head = { title: "PromptInput: With Suggestions" };

// #region demo
const PROMPTS = ["Explain this error", "Write unit tests", "Refactor for readability"];

export function WithSuggestions() {
  const value = signal("");
  return (
    <div class="flex w-[32rem] flex-col gap-3">
      <PromptInput value={value}>
        <PromptInput.Shell>
          <PromptInput.Content>
            <PromptInput.TextArea id="suggest-text" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
      <PromptSuggestion>
        <PromptSuggestion.Items>
          {PROMPTS.map((prompt) => (
            <PromptSuggestion.Item onPress={() => value.set(prompt)}>{prompt}</PromptSuggestion.Item>
          ))}
        </PromptSuggestion.Items>
      </PromptSuggestion>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithSuggestions />
    </div>
  );
}
