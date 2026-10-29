// Server-target suite: `PromptInput` token input SSR (Rivet-authored; feature set inspired by the "Token Input" section of
// HeroUI Pro's public PromptInput docs): mirror pills from `defaultValue`, the flattened text as textarea content, list
// autocomplete ARIA, a hidden empty listbox, Send enabled by the token text.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { PromptInput } from "../src/components/prompt-input/index.ts";
import {
  PromptInputTokenInput,
  PromptInputTokens,
  PromptInputTokenSuggestion,
  PromptInputTokenSuggestions,
  usePromptInputTokens,
} from "../src/components/prompt-input-tokens/index.ts";

function Composer() {
  const tokens = usePromptInputTokens({
    defaultValue: [
      { type: "text", text: "Ask " },
      { type: "token", text: "@ana", value: "u1", trigger: "@" },
      { type: "text", text: " about it" },
    ],
  });
  return (
    <PromptInput>
      <PromptInput.Shell>
        <PromptInputTokens tokens={tokens}>
          <PromptInput.Content>
            <PromptInputTokenInput />
          </PromptInput.Content>
          <PromptInputTokenSuggestions placement="top start">
            <PromptInputTokenSuggestion id="u1" token="@ana">
              Ana
            </PromptInputTokenSuggestion>
          </PromptInputTokenSuggestions>
        </PromptInputTokens>
        <PromptInput.Send />
      </PromptInput.Shell>
    </PromptInput>
  );
}

test("prompt-input tokens SSR: mirror, textarea, listbox", async () => {
  const html = await renderToString(() => <Composer />);
  assert.match(html, /<textarea[^>]*class="prompt-input__token-input"[^>]*>\nAsk @ana about it<\/textarea>/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /aria-label="What do you want to know\?"/);
  assert.match(html, /data-slot="prompt-input-token-mirror"/);
  assert.match(html, /<span class="prompt-input__token" data-segment="" data-token="@" data-value="u1">@ana<\/span>/);
  assert.match(html, /<span data-segment="">Ask <\/span>/);
  const listbox = /<div[^>]*role="listbox"[^>]*>/.exec(html)![0];
  assert.match(listbox, / hidden/);
  assert.match(listbox, /data-placement="top start"/);
  assert.match(listbox, /aria-label="Suggestions"/);
  const id = /id="([^"]+)"/.exec(listbox)![1];
  assert.match(html, new RegExp(`aria-controls="${id}"`));
  assert.match(html, new RegExp(`role="option"[^>]*|id="${id}-u1"`));
  const send = /<button[^>]*data-slot="prompt-input-send"[^>]*>/.exec(html)![0];
  assert.doesNotMatch(send, / disabled/);
});
