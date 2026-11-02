// PromptInput token suggestions first open (FIX-UI 2026-11-01): `#pt-text` token input with an `@` trigger and two
// suggestions; `prompt-tokens-open.test.ts` records the panel box every frame of the first and second open.
import { PromptInput } from "@rivetjs/ui/prompt-input";
import {
  PromptInputTokenInput,
  PromptInputTokens,
  PromptInputTokenSuggestion,
  PromptInputTokenSuggestions,
  usePromptInputTokens,
} from "@rivetjs/ui/prompt-input-tokens";

export default function PromptTokensOpen() {
  const tokens = usePromptInputTokens({ triggers: ["@"] });
  return (
    <section class="flex w-[34rem] flex-col p-10">
      <PromptInput aria-label="Mention">
        <PromptInput.Shell>
          <PromptInputTokens tokens={tokens}>
            <PromptInput.Content>
              <PromptInputTokenInput id="pt-text" placeholder="Mention someone with @…" />
            </PromptInput.Content>
            <PromptInputTokenSuggestions aria-label="People">
              <PromptInputTokenSuggestion id="ana" token="@ana">
                Ana Lima
              </PromptInputTokenSuggestion>
              <PromptInputTokenSuggestion id="ben" token="@ben">
                Ben Okafor
              </PromptInputTokenSuggestion>
            </PromptInputTokenSuggestions>
          </PromptInputTokens>
        </PromptInput.Shell>
      </PromptInput>
    </section>
  );
}
