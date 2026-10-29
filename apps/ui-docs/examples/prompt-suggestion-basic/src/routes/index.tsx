// Rivet-authored PromptSuggestion demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { PromptSuggestion } from "@rivetjs/ui/prompt-suggestion";

export const head = { title: "PromptSuggestion: Usage" };

// #region demo
const PROMPTS = ["Plan a weekend trip", "Explain a SQL query", "Write a polite reminder", "Summarise a PDF"];

export function Basic() {
  const picked = signal("");
  return (
    <div class="flex w-[30rem] flex-col gap-3">
      <PromptSuggestion>
        <PromptSuggestion.Header>
          <PromptSuggestion.Title>Try one of these</PromptSuggestion.Title>
        </PromptSuggestion.Header>
        <PromptSuggestion.Items>
          {PROMPTS.map((prompt) => (
            <PromptSuggestion.Item onPress={() => picked.set(prompt)}>{prompt}</PromptSuggestion.Item>
          ))}
        </PromptSuggestion.Items>
      </PromptSuggestion>
      <p class="text-sm text-muted">
        Picked: <span id="picked">{picked() || "nothing yet"}</span>
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
