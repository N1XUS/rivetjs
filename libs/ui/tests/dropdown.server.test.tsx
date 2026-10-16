// Server-target suite (upstream tests/components/{dropdown,menu}/*.ssr.test.tsx): `Dropdown` closed (trigger only) and
// `defaultOpen` (popover + menu + items + indicators), `Menu` inside a cdk MenuTrigger.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { MenuTrigger } from "@rivetjs/cdk/menu";
import { Popover } from "@rivetjs/cdk/popover";
import { Button, Dropdown, Label, Menu } from "../index.ts";

const Fixture = (props: { defaultOpen?: boolean }) => (
  <Dropdown defaultOpen={props.defaultOpen}>
    <Dropdown.Trigger aria-label="Menu">Actions</Dropdown.Trigger>
    <Dropdown.Popover>
      <Dropdown.Menu selectionMode="single" defaultSelectedKeys={["copy-link"]}>
        <Dropdown.Item id="new-file" textValue="New file">
          <Label>New file</Label>
        </Dropdown.Item>
        <Dropdown.Item id="copy-link" textValue="Copy link">
          <Dropdown.ItemIndicator />
          <Label>Copy link</Label>
        </Dropdown.Item>
        <Dropdown.Item id="delete-file" textValue="Delete file" variant="danger">
          <Label>Delete file</Label>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown>
);

test("dropdown SSR (upstream): closed renders the trigger only", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /data-slot="dropdown-trigger"/);
  assert.match(html, /class="dropdown__trigger"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /role="menu"/);
});

test("dropdown SSR (upstream): defaultOpen renders popover, menu, items", async () => {
  const html = await renderToString(() => <Fixture defaultOpen />);
  assert.match(html, /data-slot="dropdown-popover"/);
  assert.match(html, /class="dropdown__popover[^"]*"/);
  assert.match(html, /role="menu"/);
  assert.match(html, /data-slot="dropdown-menu"/);
  assert.match(html, /data-selection-mode="single"/);
  assert.equal(html.match(/data-slot="menu-item"/g)?.length, 3);
  assert.match(html, /class="menu-item menu-item--danger"/);
  assert.match(html, /data-slot="menu-item-indicator"[^>]*data-visible="true"|data-visible="true"[^>]*data-slot="menu-item-indicator"/);
  assert.match(html, /stroke-dashoffset="48"/);
});

test("menu SSR (upstream): closed MenuTrigger + Menu", async () => {
  const html = await renderToString(() => (
    <MenuTrigger defaultOpen>
      <Button aria-label="Menu">Actions</Button>
      <Popover>
        <Menu aria-label="m">
          <Menu.Section>
            <Menu.Item id="a">A</Menu.Item>
          </Menu.Section>
        </Menu>
      </Popover>
    </MenuTrigger>
  ));
  assert.match(html, /data-slot="menu"/);
  assert.match(html, /class="menu"/);
  assert.match(html, /class="menu-section"/);
  assert.match(html, /class="menu-item menu-item--default"/);
});

const maskIds = (html: string) => html.replace(/ (id|aria-labelledby|aria-describedby|aria-controls|data-rv-focus-scope|data-collection)="[^"]*"/g, "");

test("dropdown SSR: a Menu without Dropdown.Popover folds into the same popover; string items = Label + textValue", async () => {
  const explicit = await renderToString(() => <Fixture defaultOpen />);
  const folded = await renderToString(() => (
    <Dropdown defaultOpen>
      <Dropdown.Trigger aria-label="Menu">Actions</Dropdown.Trigger>
      <Dropdown.Menu selectionMode="single" defaultSelectedKeys={["copy-link"]}>
        <Dropdown.Item id="new-file">New file</Dropdown.Item>
        <Dropdown.Item id="copy-link">
          <Dropdown.ItemIndicator />
          <Label>Copy link</Label>
        </Dropdown.Item>
        <Dropdown.Item id="delete-file" variant="danger">
          Delete file
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  ));
  assert.equal(folded.match(/data-slot="dropdown-popover"/g)?.length, 1);
  assert.equal(maskIds(folded).replace(/ data-text="Copy link"/, ""), maskIds(explicit).replace(/ data-text="Copy link"/, ""));
});

test("dropdown SSR: item icon / description / shortcut sugar", async () => {
  const { Copy } = await import("lucide");
  const html = await renderToString(() => (
    <Dropdown defaultOpen>
      <Dropdown.Trigger>Open</Dropdown.Trigger>
      <Dropdown.Menu aria-label="m">
        <Dropdown.Item id="copy" icon={Copy} description="Copy the link" shortcut="command+C">
          Copy link
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  ));
  assert.match(html, /<svg[^>]*class="menu-item__icon"/);
  assert.match(html, /<div class="menu-item__text"><label[^>]*data-slot="label"[^>]*>Copy link<\/label>/);
  assert.match(html, /data-slot="description"[^>]*>Copy the link</);
  assert.match(html, /<kbd[^>]*class="kbd kbd--light menu-item__shortcut"[^>]*><abbr class="kbd__abbr" title="Command">/);
});
