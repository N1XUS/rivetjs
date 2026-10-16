// Server-target suite: `PromptSuggestion` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public
// PromptSuggestion docs): pill / card variants, header parts, items as buttons.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { PromptSuggestion } from "../src/components/prompt-suggestion/index.ts";

test("prompt-suggestion SSR: pill + card", async () => {
  const pill = await renderToString(() => (
    <PromptSuggestion>
      <PromptSuggestion.Items>
        <PromptSuggestion.Item>Summarize</PromptSuggestion.Item>
      </PromptSuggestion.Items>
    </PromptSuggestion>
  ));
  assert.match(pill, /data-variant="pill"/);
  assert.match(pill, /<button[^>]*prompt-suggestion__item/);
  const card = await renderToString(() => (
    <PromptSuggestion variant="card">
      <PromptSuggestion.Header>
        <PromptSuggestion.Title>Start</PromptSuggestion.Title>
        <PromptSuggestion.Description>Pick one</PromptSuggestion.Description>
      </PromptSuggestion.Header>
      <PromptSuggestion.Items>
        <PromptSuggestion.Item>
          <PromptSuggestion.ItemTitle>Plan</PromptSuggestion.ItemTitle>
          <PromptSuggestion.ItemDescription>Make a plan</PromptSuggestion.ItemDescription>
        </PromptSuggestion.Item>
      </PromptSuggestion.Items>
    </PromptSuggestion>
  ));
  assert.match(card, /data-variant="card"/);
  assert.match(card, /<h2[^>]*>Start<\/h2>/);
  assert.match(card, /<p[^>]*>Pick one<\/p>/);
  assert.match(card, /prompt-suggestion__item-title[^>]*>Plan</);
});
