// Server-target suite: ContextMenu (trigger SSR, closed menu absent, disabled marker) + Command (closed: only the trigger;
// defaultOpen: the palette in the server HTML with its size / backdrop classes, header, input defaults, groups, footer).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Button } from "../src/components/button/index.ts";
import { ContextMenu } from "../src/components/context-menu/index.ts";
import { Command } from "../src/components/command/index.ts";

test("context menu SSR: trigger, closed popover absent, disabled", async () => {
  const html = await renderToString(() => (
    <ContextMenu>
      <ContextMenu.Trigger>Area</ContextMenu.Trigger>
      <ContextMenu.Popover>
        <ContextMenu.Menu>
          <ContextMenu.Item id="a">A</ContextMenu.Item>
        </ContextMenu.Menu>
      </ContextMenu.Popover>
    </ContextMenu>
  ));
  assert.match(html, /<div class="context-menu__trigger" data-slot="context-menu-trigger"[^>]*>Area<\/div>/);
  assert.doesNotMatch(html, /role="menu"/);
  const off = await renderToString(() => (
    <ContextMenu isDisabled>
      <ContextMenu.Trigger>Area</ContextMenu.Trigger>
      <ContextMenu.Popover>x</ContextMenu.Popover>
    </ContextMenu>
  ));
  assert.match(off, /data-slot="context-menu-trigger" data-disabled="true">Area</);
  assert.doesNotMatch(off, />x</);
});

const Palette = (props: { defaultOpen?: boolean }) => (
  <Command defaultOpen={props.defaultOpen}>
    <Button>Open</Button>
    <Command.Backdrop variant="transparent">
      <Command.Container size="sm">
        <Command.Dialog>
          <Command.Header>Head</Command.Header>
          <Command.InputGroup>
            <Command.InputGroup.Input />
          </Command.InputGroup>
          <Command.List>
            <Command.Group heading="General">
              <Command.Item id="one">One</Command.Item>
            </Command.Group>
          </Command.List>
          <Command.Footer>Foot</Command.Footer>
        </Command.Dialog>
      </Command.Container>
    </Command.Backdrop>
  </Command>
);

test("command SSR: closed renders the trigger only; defaultOpen renders the palette", async () => {
  const closed = await renderToString(() => <Palette />);
  assert.match(closed, />Open</);
  assert.doesNotMatch(closed, /command__dialog/);
  const html = await renderToString(() => <Palette defaultOpen />);
  assert.match(html, /class="command__backdrop command__backdrop--transparent"/);
  assert.match(html, /class="command__dialog command__dialog--sm"/);
  assert.match(html, /aria-label="Command palette"/);
  assert.match(html, /data-slot="command-header">Head</);
  assert.match(html, /placeholder="Search commands\.\.\."/);
  assert.match(html, /command__group-heading"[^>]*>General</);
  assert.match(html, /data-slot="command-footer">Foot</);
});
