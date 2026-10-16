// Server-target suite: `ListBox` SSR — listbox / option roles, classes, sections, default checkmark indicator.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Header, Label, ListBox } from "../index.ts";

test("list-box SSR: roles + classes", async () => {
  const html = await renderToString(() => (
    <ListBox aria-label="Users" selectionMode="single" defaultSelectedKeys={["bob"]}>
      <ListBox.Section>
        <Header>People</Header>
        <ListBox.Item id="bob" textValue="Bob">
          <Label>Bob</Label>
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="fred" textValue="Fred">
          <Label>Fred</Label>
        </ListBox.Item>
      </ListBox.Section>
    </ListBox>
  ));
  assert.match(html, /role="listbox"/);
  assert.match(html, /class="list-box list-box--default"/);
  assert.match(html, /data-slot="list-box"/);
  assert.equal(html.match(/role="option"/g)?.length, 2);
  assert.match(html, /class="list-box-item list-box-item--default"/);
  assert.match(html, /<section[^>]*class="list-box-section"/);
  assert.match(html, /class="list-box-item__indicator"[^>]*data-visible="true"|data-visible="true"[^>]*class="list-box-item__indicator"/);
  assert.match(html, /data-slot="list-box-item-indicator--checkmark"/);
  assert.match(html, /stroke-dashoffset="48"/);
});
