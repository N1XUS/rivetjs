// Server-target suite (Rivet additions, feature sets inspired by HeroUI Pro's public docs, independent implementations):
// CellSwitch (switch field + row label, variants, shorthand, default thumb), HoverCard (focusable trigger with the preview
// trigger's ARIA, closed card renders nothing), EmojiReactionButton (toggle button aria-pressed, sizes, parts, read-only).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CellSwitch } from "../src/components/cell-switch/index.ts";
import { HoverCard } from "../src/components/hover-card/index.ts";
import { EmojiReactionButton } from "../src/components/emoji-reaction-button/index.ts";

test("cell switch SSR: parts, variant classes, default thumb", async () => {
  const html = await renderToString(() => (
    <CellSwitch variant="secondary" defaultSelected>
      <CellSwitch.Trigger>
        <CellSwitch.Label>Wi-Fi</CellSwitch.Label>
        <CellSwitch.Control />
      </CellSwitch.Trigger>
    </CellSwitch>
  ));
  assert.match(html, /class="[^"]*switch[^"]*cell-switch cell-switch--secondary/);
  assert.match(html, /<label data-slot="switch-content"[^>]*class="switch__content cell-switch__trigger cell-switch__trigger--secondary"/);
  assert.match(html, /<input[^>]*checked[^>]*role="switch"/);
  assert.match(html, /<span class="cell-switch__label" data-slot="cell-switch-label">Wi-Fi<\/span>/);
  assert.match(html, /class="[^"]*cell-switch__control cell-switch__control--secondary[^"]*" data-slot="switch-control"><span class="[^"]*switch__thumb/);
});

test("cell switch SSR: shorthand label + description, default variant", async () => {
  const html = await renderToString(() => <CellSwitch label="Notifications" description="Push and email" />);
  assert.match(html, /cell-switch__trigger cell-switch__trigger--default/);
  assert.match(
    html,
    /data-slot="cell-switch-label">Notifications<span class="cell-switch__description" data-slot="cell-switch-description">Push and email<\/span><\/span>/,
  );
  assert.doesNotMatch(html, /checked/);
});

test("hover card SSR: focusable trigger, ARIA, closed card absent", async () => {
  const html = await renderToString(() => (
    <HoverCard>
      <HoverCard.Trigger>@rivet</HoverCard.Trigger>
      <HoverCard.Content aria-label="Profile">
        <HoverCard.Arrow />
        Card
      </HoverCard.Content>
    </HoverCard>
  ));
  assert.match(html, /<span[^>]*class="hover-card__trigger"[^>]*>@rivet<\/span>/);
  assert.match(html, /data-slot="hover-card-trigger"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /hover-card__content/);
  const open = await renderToString(() => (
    <HoverCard defaultOpen>
      <HoverCard.Trigger>@rivet</HoverCard.Trigger>
      <HoverCard.Content aria-label="Profile">Card</HoverCard.Content>
    </HoverCard>
  ));
  assert.match(open, /aria-expanded="true"/);
});

test("emoji reaction button SSR: toggle, sizes, parts, read-only", async () => {
  const html = await renderToString(() => (
    <EmojiReactionButton defaultSelected aria-label="Thumbs up, 12 reactions">
      <EmojiReactionButton.Emoji>👍</EmojiReactionButton.Emoji>
      <EmojiReactionButton.Count>12</EmojiReactionButton.Count>
    </EmojiReactionButton>
  ));
  assert.match(html, /<button[^>]*class="emoji-reaction-button emoji-reaction-button--md"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /data-selected="true"/);
  assert.match(html, /<span class="emoji-reaction-button__emoji" data-slot="emoji-reaction-button-emoji">👍<\/span>/);
  assert.match(html, /<span class="emoji-reaction-button__count" data-slot="emoji-reaction-button-count">12<\/span>/);
  const ro = await renderToString(() => (
    <EmojiReactionButton size="lg" isReadOnly isSelected>
      <EmojiReactionButton.Emoji>🎉</EmojiReactionButton.Emoji>
    </EmojiReactionButton>
  ));
  assert.match(ro, /emoji-reaction-button--lg/);
  assert.match(ro, /data-readonly="true"/);
  assert.match(ro, /aria-pressed="true"/);
  const sm = await renderToString(() => <EmojiReactionButton size="sm">x</EmojiReactionButton>);
  assert.match(sm, /emoji-reaction-button--sm/);
  assert.match(sm, /aria-pressed="false"/);
});
