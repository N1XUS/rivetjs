// Server-target suite: `ToggleButton`, `ButtonGroup`, `ToggleButtonGroup` SSR markup (classes, data-slot, ARIA, inherited group
// props, separators).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Button, ButtonGroup, ToggleButton, ToggleButtonGroup } from "../index.ts";

test("toggle-button SSR: classes, data-slot, aria-pressed, defaultSelected", async () => {
  const html = await renderToString(() => (
    <ToggleButton defaultSelected size="sm" variant="ghost">
      Bold
    </ToggleButton>
  ));
  assert.match(html, /<button/);
  assert.match(html, /class="toggle-button[^"]*toggle-button--sm[^"]*toggle-button--ghost[^"]*"/);
  assert.match(html, /data-slot="toggle-button"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /data-selected="true"/);
  assert.match(html, />Bold</);
});

test("button-group SSR: role=group, classes, inherited size / variant / disabled, separator", async () => {
  const html = await renderToString(() => (
    <ButtonGroup size="sm" variant="secondary" isDisabled orientation="vertical">
      <Button>One</Button>
      <ButtonGroup.Separator />
      <Button variant="primary">Two</Button>
    </ButtonGroup>
  ));
  assert.match(html, /role="group"/);
  assert.match(html, /data-slot="button-group"/);
  assert.match(html, /class="button-group button-group--vertical"/);
  assert.match(html, /data-disabled="true"/);
  const buttons = html.match(/<button[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2);
  for (const b of buttons) {
    assert.match(b, /button--sm/);
    assert.match(b, /disabled/);
  }
  assert.match(buttons[0]!, /button--secondary/);
  assert.match(buttons[1]!, /button--primary/);
  assert.match(
    html,
    /<span[^>]*aria-hidden="true"[^>]*class="button-group__separator"[^>]*data-slot="button-group-separator"|<span[^>]*data-slot="button-group-separator"/,
  );
});

test("toggle-button-group SSR: role, classes, inherited size, selection + disabled on the buttons", async () => {
  const html = await renderToString(() => (
    <ToggleButtonGroup selectionMode="single" defaultSelectedKeys={["left"]} size="lg" isDetached isDisabled>
      <ToggleButton id="left">Left</ToggleButton>
      <ToggleButton id="center">
        <ToggleButtonGroup.Separator />
        Center
      </ToggleButton>
    </ToggleButtonGroup>
  ));
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /data-slot="toggle-button-group"/);
  assert.match(
    html,
    /class="toggle-button-group toggle-button-group--detached toggle-button-group--horizontal"|class="toggle-button-group[^"]*--detached[^"]*"/,
  );
  const buttons = html.match(/<button[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2);
  for (const b of buttons) {
    assert.match(b, /toggle-button--lg/);
    assert.match(b, /role="radio"/);
    assert.match(b, /disabled/);
  }
  assert.match(buttons[0]!, /aria-checked="true"/);
  assert.match(buttons[1]!, /aria-checked="false"/);
  assert.match(html, /class="toggle-button-group__separator"/);
  assert.match(html, /data-slot="toggle-button-group-separator"/);
});
