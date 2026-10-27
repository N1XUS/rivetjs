// Server-target suite: PressableFeedback (Rivet addition, feature set inspired by HeroUI Pro's public Pressable Feedback docs):
// root button markup, layer classes, sweep / duration variables, aria-hidden layers.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { PressableFeedback } from "../src/components/pressable-feedback/index.ts";

test("pressable feedback SSR: root, highlight, ripple, hold confirm, progress", async () => {
  const html = await renderToString(() => (
    <PressableFeedback>
      <PressableFeedback.Highlight />
      <PressableFeedback.Ripple duration={300} />
      <PressableFeedback.HoldConfirm duration={1000} sweep="left">
        Deleting
      </PressableFeedback.HoldConfirm>
      <PressableFeedback.ProgressFeedback sweep="up" />
      Press me
    </PressableFeedback>
  ));
  assert.match(
    html,
    /<button[^>]*class="pressable-feedback"[^>]*data-slot="pressable-feedback"|<button[^>]*data-slot="pressable-feedback"[^>]*class="pressable-feedback"/,
  );
  assert.match(html, /aria-hidden="true" class="pressable-feedback__highlight"/);
  assert.match(html, /class="pressable-feedback__ripple"[^>]*style="[^"]*--pressable-feedback-ripple-duration:\s*300ms/);
  assert.match(html, /pressable-feedback__ripple-surface/);
  assert.match(
    html,
    /class="pressable-feedback__hold-confirm"[^>]*data-sweep="left"[^>]*style="[^"]*--pressable-feedback-hold-confirm-duration:\s*1000ms[^>]*>Deleting</,
  );
  assert.match(html, /class="pressable-feedback__progress-feedback"[^>]*data-sweep="up"/);
  assert.match(html, />Press me<\/button>/);
});

test("pressable feedback SSR: disabled root", async () => {
  const html = await renderToString(() => <PressableFeedback isDisabled>Off</PressableFeedback>);
  assert.match(html, /<button[^>]*disabled/);
});
