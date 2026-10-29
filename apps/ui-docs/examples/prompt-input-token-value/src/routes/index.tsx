// Rivet-authored PromptInput demo (Rivet addition; feature scope from public docs of commercial UI kits, own content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import {
  PromptInputTokenInput,
  PromptInputTokenSuggestion,
  PromptInputTokenSuggestions,
  PromptInputTokens,
  usePromptInputTokens,
} from "@rivetjs/ui/prompt-input-tokens";
import type { PromptSegment, PromptTokenValue } from "@rivetjs/ui/prompt-input-tokens";

export const head = { title: "PromptInput: Token value" };

// #region demo
const LABELS = [
  { id: "bug", name: "bug" },
  { id: "needs-review", name: "needs review" },
  { id: "good-first-issue", name: "good first issue" },
];

const DRAFT: PromptTokenValue = [
  { type: "text", text: "Triage this as " },
  { type: "token", text: "#bug", value: "bug", trigger: "#" },
  { type: "text", text: " and assign it" },
];

export function TokenValue() {
  // Two-way segments: the Signal follows every edit, `setValue` replaces them.
  const value = signal<PromptTokenValue>(DRAFT);
  const tokens = usePromptInputTokens({ triggers: ["#"], allowsSpaces: true, value });
  const labels = () => LABELS.filter((label) => label.name.startsWith(tokens.query().toLowerCase()));
  const picked = () =>
    value()
      .filter((segment: PromptSegment) => segment.type === "token")
      .map((segment: PromptSegment) => (segment.type === "token" ? segment.value : ""))
      .join(", ");
  return (
    <div class="flex w-[34rem] flex-col gap-3">
      <PromptInput>
        <PromptInput.Shell>
          <PromptInputTokens tokens={tokens}>
            <PromptInput.Content>
              <PromptInputTokenInput id="labels-text" placeholder="Add labels with # (spaces allowed)" />
            </PromptInput.Content>
            <PromptInputTokenSuggestions aria-label="Labels">
              <For each={labels} by={(label: (typeof LABELS)[number]) => label.id}>
                {(label: () => (typeof LABELS)[number]) => (
                  <PromptInputTokenSuggestion id={label().id} token={`#${label().name}`}>
                    <span class="size-2 rounded-full bg-accent" aria-hidden="true" />
                    {label().name}
                  </PromptInputTokenSuggestion>
                )}
              </For>
            </PromptInputTokenSuggestions>
          </PromptInputTokens>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarStart>
              <Button id="labels-reset" size="sm" variant="ghost" onPress={() => tokens.setValue(DRAFT)}>
                Reset draft
              </Button>
            </PromptInput.ToolbarStart>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
      <output id="labels-picked" class="text-sm text-muted">
        Labels: {picked() || "none"}
      </output>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 pt-10 [:where(&>*)]:max-w-full">
      <TokenValue />
    </div>
  );
}
