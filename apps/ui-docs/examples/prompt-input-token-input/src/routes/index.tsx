// Rivet-authored PromptInput demo (Rivet addition; "Token Input" section of HeroUI Pro's public docs, own content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import {
  PromptInputTokenInput,
  PromptInputTokenSuggestion,
  PromptInputTokenSuggestions,
  PromptInputTokens,
  usePromptInputTokens,
} from "@rivetjs/ui/prompt-input-tokens";

export const head = { title: "PromptInput: Token Input" };

// #region demo
const PEOPLE = [
  { id: "ana", name: "Ana Lima", role: "Design" },
  { id: "ben", name: "Ben Okafor", role: "Backend" },
  { id: "chloe", name: "Chloé Martin", role: "Product" },
  { id: "dev", name: "Dev Patel", role: "Frontend" },
];

export function TokenInput() {
  const tokens = usePromptInputTokens({ triggers: ["@"] });
  const sent = signal("");
  const people = () => {
    const query = tokens.query().toLowerCase();
    return PEOPLE.filter((person) => person.id.startsWith(query) || person.name.toLowerCase().includes(query));
  };
  return (
    <div class="flex w-[34rem] flex-col gap-3">
      <PromptInput onSubmit={(text) => sent.set(text)}>
        <PromptInput.Shell>
          <PromptInputTokens tokens={tokens}>
            <PromptInput.Content>
              <PromptInputTokenInput id="token-text" placeholder="Mention someone with @…" />
            </PromptInput.Content>
            <PromptInputTokenSuggestions aria-label="People">
              <For each={people} by={(person: (typeof PEOPLE)[number]) => person.id}>
                {(person: () => (typeof PEOPLE)[number]) => (
                  <PromptInputTokenSuggestion id={person().id} token={`@${person().id}`} textValue={person().name}>
                    <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent-soft-foreground">
                      {person().name[0]}
                    </span>
                    <span class="flex min-w-0 flex-col">
                      <span class="truncate">{person().name}</span>
                      <span class="truncate text-xs text-muted">{person().role}</span>
                    </span>
                  </PromptInputTokenSuggestion>
                )}
              </For>
            </PromptInputTokenSuggestions>
          </PromptInputTokens>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send id="token-send" />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
      <output id="token-sent" class="text-sm text-muted">
        {sent() ? `Sent: ${sent()}` : "Type @ to mention a teammate."}
      </output>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 pt-10 [:where(&>*)]:max-w-full">
      <TokenInput />
    </div>
  );
}
