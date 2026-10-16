// Server-target suite: `ActionBar` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public ActionBar docs): the fixed
// layer + toolbar pill are always server-rendered (closed: no `data-open`; open: `data-open="true"`), default `aria-label`,
// attached pill classes, part classes / slots, polite live region on the prefix, vertical orientation.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ActionBar } from "../src/components/action-bar/index.ts";

const Fixture = (props: { isOpen: boolean; orientation?: "horizontal" | "vertical" }) => (
  <ActionBar isOpen={props.isOpen} orientation={props.orientation}>
    <ActionBar.Prefix>3 selected</ActionBar.Prefix>
    <ActionBar.Content>
      <button type="button">
        <span class="action-bar__label">Archive</span>
      </button>
    </ActionBar.Content>
    <ActionBar.Suffix>
      <button type="button">Clear</button>
    </ActionBar.Suffix>
  </ActionBar>
);

test("action-bar SSR: closed + open markup", async () => {
  const closed = await renderToString(() => <Fixture isOpen={false} />);
  assert.match(closed, /<div[^>]*class="action-bar action-bar--horizontal"/);
  assert.match(closed, /data-slot="action-bar"/);
  assert.doesNotMatch(closed, /data-open=/);
  assert.match(closed, /role="toolbar"/);
  assert.match(closed, /aria-label="Actions"/);
  assert.match(closed, /class="[^"]*action-bar__wrapper[^"]*toolbar--attached|class="[^"]*toolbar--attached[^"]*action-bar__wrapper/);
  assert.match(closed, /<div[^>]*class="action-bar__prefix"[^>]*aria-live="polite"|aria-live="polite"[^>]*class="action-bar__prefix"/);
  assert.match(closed, /class="action-bar__content"/);
  assert.match(closed, /class="action-bar__suffix"/);
  assert.match(closed, /3 selected/);
  const open = await renderToString(() => <Fixture isOpen />);
  assert.match(open, /data-open="true"/);
});

test("action-bar SSR: vertical", async () => {
  const html = await renderToString(() => <Fixture isOpen orientation="vertical" />);
  assert.match(html, /class="action-bar action-bar--vertical"/);
  assert.match(html, /aria-orientation="vertical"/);
});
