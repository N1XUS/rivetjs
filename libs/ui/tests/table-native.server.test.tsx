// Server-target suite: TABLE-NATIVE static path of `Table` (`$native: 1` = the build proved the call site static,
// `libs/compiler/facts-native.ts`). Native `table` / `thead` / `tbody` / `tr` / `th scope` / `td` markup with the grid
// path's classes and `data-slot`s (same element sequence), row headers as `th scope="row"` (incl. after a `colSpan`), the
// auto form (`columns` / `items` / `footer`, the name on the `<table>`); the root falls back to the cdk grid for a live
// prop, an undeclared prop, a sortable auto-form column, a cdk `TableContext` value or the collection build pass above.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Provider } from "@rivetjs/runtime/dom";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { TableContext as TablePrimitiveContext } from "@rivetjs/cdk/table";
import { HiddenContext } from "@rivetjs/cdk/collections/hidden";
import { Table } from "../src/components/table/index.ts";

const NATIVE = { $native: 1 } as {};

const compound = (extra: object = {}) => (
  <Table {...NATIVE} {...extra} data-x="1">
    <Table.ScrollContainer>
      <Table.Content aria-label="Team" class="min-w-[600px]" data-y="2">
        <Table.Header>
          <Table.Column>Role</Table.Column>
          <Table.Column isRowHeader>Name</Table.Column>
          <Table.Column>Email</Table.Column>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>CEO</Table.Cell>
            <Table.Cell>Kate</Table.Cell>
            <Table.Cell>kate@acme.com</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell colSpan={2}>Vacant</Table.Cell>
            <Table.Cell>-</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Content>
    </Table.ScrollContainer>
    <Table.Footer>2 members</Table.Footer>
  </Table>
);

const isGrid = (html: string) => /role="grid"/.test(html);
/** Each element's tag, class and data-slot in document order (the grid's `td role=rowheader` = the native `th scope=row`). */
const shape = (html: string) =>
  [...html.matchAll(/<(div|table|thead|tbody|tr|th|td)\b([^>]*)>/g)].map(([, tag, attrs]) => {
    const cls = /class="([^"]*)"/.exec(attrs!)?.[1] ?? "";
    const slot = /data-slot="([^"]*)"/.exec(attrs!)?.[1] ?? "";
    const cell = tag === "th" && / scope="row"/.test(attrs!) ? "td" : tag;
    return `${cell}.${cls}#${slot}`;
  });

test("table native: semantic table markup, row headers, no grid attributes", async () => {
  const html = await renderToString(() => compound());
  assert.equal(isGrid(html), false);
  assert.doesNotMatch(html, /tabindex|role=|data-key|aria-colindex|hidden>|data-rk/);
  assert.match(html, /<div[^>]*data-x="1"[^>]*class="table-root table-root--primary"[^>]*data-slot="table"/);
  assert.match(html, /<table aria-label="Team" data-y="2" class="table__content min-w-\[600px\]" data-slot="table-content">/);
  assert.deepEqual(
    [...html.matchAll(/<(th|td)\b([^>]*)>([^<]*)</g)].map(([, tag, attrs, text]) => [tag, /scope="\w+"/.exec(attrs!)?.[0], text].filter(Boolean).join(" ")),
    ['th scope="col" Role', 'th scope="col" Name', 'th scope="col" Email', "td CEO", 'th scope="row" Kate', "td kate@acme.com", "td Vacant", "td -"],
  );
  // `colSpan` 2 covers columns 0-1: the next cell is column 2 (a plain cell).
  assert.match(html, /<td colspan="2" class="table__cell" data-slot="table-cell">Vacant/i);
  assert.match(html, /<div class="table__footer" data-slot="table-footer">2 members<\/div>/);
});

test("table native: same element / class / data-slot sequence as the grid path (both variants)", async () => {
  for (const variant of [undefined, "secondary"] as const) {
    const native = shape(await renderToString(() => compound({ variant })));
    const grid = shape(
      await renderToString(() => (
        <Table variant={variant}>
          <Table.ScrollContainer>
            <Table.Content aria-label="Team" class="min-w-[600px]">
              <Table.Header>
                <Table.Column>Role</Table.Column>
                <Table.Column isRowHeader>Name</Table.Column>
                <Table.Column>Email</Table.Column>
              </Table.Header>
              <Table.Body>
                <Table.Row>
                  <Table.Cell>CEO</Table.Cell>
                  <Table.Cell>Kate</Table.Cell>
                  <Table.Cell>kate@acme.com</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )),
    );
    // The grid path adds three hidden description divs after the table; the native one has a second row + footer.
    const nativeOneRow = native.filter((_, i) => i < 11);
    assert.deepEqual(nativeOneRow, grid.slice(0, 11), String(variant));
  }
});

test("table native: auto form (columns + items + footer), the accessible name on the table", async () => {
  const columns = [
    { id: "name", name: "Name", isRowHeader: true },
    { id: "role", name: "Role" },
  ];
  const items = [
    { id: "1", name: "Kate", role: "CEO" },
    { id: "2", name: "John", role: "CTO" },
  ];
  const html = await renderToString(() => <Table {...NATIVE} aria-label="Team" columns={columns} items={items} footer="2 members" id="t1" />);
  assert.equal(isGrid(html), false);
  assert.match(html, /<div id="t1" class="table-root table-root--primary" data-slot="table">/);
  assert.match(html, /<table aria-label="Team" class="table__content" data-slot="table-content">/);
  assert.deepEqual(
    [...html.matchAll(/<(th|td)\b[^>]*>([^<]*)</g)].map(([, tag, text]) => `${tag} ${text}`),
    ["th Name", "th Role", "th Kate", "td CEO", "th John", "td CTO"],
  );
  assert.match(html, /data-slot="table-footer">2 members</);
});

test("table native: the root keeps the grid path for anything the native markup cannot carry", async () => {
  const grid = async (label: string, fn: () => unknown) => assert.equal(isGrid(await renderToString(fn as never)), true, label);
  // No build mark.
  await grid("no mark", () => <Table aria-label="Team" columns={[{ id: "name", name: "Name", isRowHeader: true }]} items={[{ id: "1", name: "Kate" }]} />);
  // A live prop (getter), an undeclared prop.
  const live = { $native: 1, "aria-label": "Team", columns: [{ id: "name", name: "Name", isRowHeader: true }] } as Record<string, unknown>;
  Object.defineProperty(live, "items", { enumerable: true, get: () => [{ id: "1", name: "Kate" }] });
  await grid("getter", () => Table(live as never));
  await grid("undeclared", () => (
    <Table {...NATIVE} aria-label="Team" selectionMode="multiple" columns={[{ id: "name", name: "Name", isRowHeader: true }]} items={[]} />
  ));
  // A sortable auto-form column; a non-array `items` (a live collection).
  await grid("sortable", () => (
    <Table {...NATIVE} aria-label="Team" columns={[{ id: "name", name: "Name", isRowHeader: true, allowsSorting: true }]} items={[]} />
  ));
  await grid("set items", () => (
    <Table {...NATIVE} aria-label="Team" columns={[{ id: "name", name: "Name", isRowHeader: true }]} items={new Set([{ id: "1", name: "Kate" }])} />
  ));
  // A cdk TableContext value above (slots merge table props), the collection build pass.
  await grid("cdk context", () => (
    <Provider token={TablePrimitiveContext} value={{ selectionMode: "single" }}>
      {compound()}
    </Provider>
  ));
  const hidden = await renderToString(() => (
    <Provider token={HiddenContext} value={true}>
      {compound()}
    </Provider>
  ));
  assert.doesNotMatch(hidden, /scope="col"/);
});
