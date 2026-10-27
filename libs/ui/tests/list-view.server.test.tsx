// Server-target suite: ListView (Rivet addition, feature set inspired by HeroUI Pro's public List View docs): grid markup
// (cdk GridList stack layout), variant classes, parts, selection checkboxes only with selection on, disabled rows, empty state.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ListView } from "../src/components/list-view/index.ts";

test("list view SSR: grid, rows, parts, primary default", async () => {
  const html = await renderToString(() => (
    <ListView aria-label="Files">
      <ListView.Item id="a" textValue="Report">
        <ListView.ItemContent>
          <div>
            <ListView.Title>Report</ListView.Title>
            <ListView.Description>2 MB</ListView.Description>
          </div>
        </ListView.ItemContent>
        <ListView.ItemAction>
          <button type="button">Open</button>
        </ListView.ItemAction>
      </ListView.Item>
      <ListView.Item id="b" textValue="Notes">
        Notes
      </ListView.Item>
    </ListView>
  ));
  assert.match(html, /role="grid"/);
  assert.match(html, /class="list-view list-view--primary[^"]*"/);
  assert.match(html, /data-variant="primary"/);
  assert.equal((html.match(/role="row"/g) ?? []).length, 2);
  assert.match(html, /class="list-view__item[^"]*"/);
  assert.match(html, /list-view__title[^>]*>Report</);
  assert.match(html, /list-view__description[^>]*>2 MB</);
  assert.match(html, /list-view__item-action/);
  assert.doesNotMatch(html, /list-view__selection-cell/);
});

test("list view SSR: secondary, selection checkboxes, disabled", async () => {
  const html = await renderToString(() => (
    <ListView aria-label="People" variant="secondary" selectionMode="multiple" disabledKeys={["b"]}>
      <ListView.Item id="a" textValue="Ada">
        Ada
      </ListView.Item>
      <ListView.Item id="b" textValue="Bob">
        Bob
      </ListView.Item>
    </ListView>
  ));
  assert.match(html, /list-view--secondary/);
  assert.equal((html.match(/list-view__selection-cell/g) ?? []).length, 2);
  assert.match(html, /aria-multiselectable="true"/);
  assert.match(html, /data-disabled="true"[^>]*>|aria-disabled="true"/);
});

test("list view SSR: empty state", async () => {
  const html = await renderToString(() => (
    <ListView aria-label="Empty" items={[]} renderEmptyState={() => <ListView.EmptyState>Nothing here</ListView.EmptyState>}>
      {(item: { id: string }) => <ListView.Item textValue={item.id}>{item.id}</ListView.Item>}
    </ListView>
  ));
  assert.match(html, /list-view__empty-state[^>]*>Nothing here</);
});
