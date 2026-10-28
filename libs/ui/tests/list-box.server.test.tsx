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

for (const rowHeight of [undefined, 48]) {
  test(`list-box SSR: 10k server window, rowHeight=${rowHeight ?? "default"}`, async () => {
    const items = Array.from({ length: 10000 }, (_, id) => ({ id: String(id), name: `Item ${id}` }));
    const html = await renderToString(() => (
      <ListBox virtualized rowHeight={rowHeight} initialSize={{ width: 300, height: 180 }} aria-label="Large list" items={items}>
        {(item: { id: string; name: string }) => (
          <ListBox.Item id={item.id} textValue={item.name}>
            {item.name}
          </ListBox.Item>
        )}
      </ListBox>
    ));
    const count = (html.match(/role="option"/g) ?? []).length;
    assert.ok(count >= 4 && count < 20, `server window: ${count}`);
    assert.match(html, /aria-setsize="10000"/);
    assert.match(html, /aria-posinset="1"/);
    assert.match(html, /data-ui-virtualized="true"/);
    assert.match(html, new RegExp(`height:\\s*${(rowHeight ?? 36) * 10000}px`));
    assert.doesNotMatch(html, />Item 9999</);
  });
}

test("list-box SSR: opting out preserves ordinary markup and strips virtualizer props", async () => {
  const output = (optOut: boolean) =>
    renderToString(() => (
      <ListBox aria-label="Plain" {...(optOut ? { virtualized: false, rowHeight: 99, initialSize: { width: 300, height: 180 } } : {})}>
        <ListBox.Item id="a">Alpha</ListBox.Item>
      </ListBox>
    ));
  // Generated instance IDs differ per render; all markup around them must stay identical.
  const normalize = (html: string) => html.replace(/rvs\d+/g, "rv-id");
  assert.equal(normalize(await output(true)), normalize(await output(false)));
});
