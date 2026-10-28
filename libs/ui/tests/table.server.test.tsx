// Server-target suite: `Table` SSR — shell slots + BEM classes, native table markup with grid roles, sortable header indicator,
// dynamic rows, footer.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Table } from "../index.ts";

const rows = [
  { id: "1", name: "Kate", role: "CEO" },
  { id: "2", name: "John", role: "CTO" },
];

test("table SSR: shell + parts + classes", async () => {
  const html = await renderToString(() => (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Team" sortDescriptor={{ column: "name", direction: "ascending" }}>
          <Table.Header>
            <Table.Column allowsSorting isRowHeader id="name">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Member</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column id="role">Role</Table.Column>
          </Table.Header>
          <Table.Body items={rows}>
            {(row: (typeof rows)[number]) => (
              <Table.Row id={row.id}>
                <Table.Cell>{row.name}</Table.Cell>
                <Table.Cell>{row.role}</Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      <Table.Footer>2 members</Table.Footer>
    </Table>
  ));
  assert.match(
    html,
    /<div[^>]*class="table-root table-root--secondary"[^>]*data-slot="table"|<div[^>]*data-slot="table"[^>]*class="table-root table-root--secondary"/,
  );
  assert.match(html, /class="table__scroll-container"/);
  assert.match(html, /<table[^>]*role="grid"/);
  assert.match(html, /<table[^>]*class="table__content/);
  assert.match(html, /<thead[^>]*class="table__header/);
  assert.match(html, /<th[^>]*class="table__column/);
  assert.match(html, /<tbody[^>]*class="table__body/);
  assert.equal(html.match(/data-slot="table-row"/g)?.length, 2);
  assert.equal(html.match(/data-slot="table-cell"/g)?.length, 4);
  assert.match(html, />Kate</);
  assert.match(html, /data-slot="table-sortable-column-header"[^>]*>Member/);
  assert.match(html, /data-direction="ascending"/);
  assert.match(html, /data-slot="table-sortable-column-indicator"/);
  assert.match(html, /<div[^>]*class="table__footer"[^>]*>2 members<\/div>|<div[^>]*data-slot="table-footer"[^>]*>2 members/);
});

test("table SSR: auto form matches the compound form", async () => {
  const mask = (html: string) => html.replace(/ (id|aria-labelledby|aria-describedby|aria-controls|data-collection|data-key)="[^"]*"/g, "");
  const sort = { column: "name", direction: "ascending" } as const;
  const explicit = await renderToString(() => (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Team" sortDescriptor={sort}>
          <Table.Header>
            <Table.Column allowsSorting isRowHeader id="name">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Member</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column id="role">Role</Table.Column>
          </Table.Header>
          <Table.Body items={rows}>
            {(row: (typeof rows)[number]) => (
              <Table.Row id={row.id}>
                <Table.Cell>{row.name}</Table.Cell>
                <Table.Cell>{row.role}</Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      <Table.Footer>2 members</Table.Footer>
    </Table>
  ));
  const columns = [
    { id: "name", name: "Member", isRowHeader: true, allowsSorting: true },
    { id: "role", name: "Role" },
  ];
  const folded = await renderToString(() => <Table aria-label="Team" columns={columns} footer="2 members" items={rows} sortDescriptor={sort} />);
  assert.equal(mask(folded), mask(explicit));
});

for (const rowHeight of [undefined, 40]) {
  test(`table SSR: virtualized data form windows 10k rows (${rowHeight ?? "default"})`, async () => {
    const items = Array.from({ length: 10000 }, (_, id) => ({ id: String(id), name: `Member ${id}` }));
    const html = await renderToString(() => (
      <Table
        virtualized
        rowHeight={rowHeight}
        headingHeight={36}
        initialSize={{ width: 600, height: 240 }}
        aria-label="Members"
        columns={[{ id: "name", name: "Name", isRowHeader: true }]}
        items={items}
      />
    ));
    const count = (html.match(/data-slot="table-row"/g) ?? []).length;
    assert.ok(count >= 4 && count < 20, `server window: ${count}`);
    assert.match(html, /aria-rowcount="10001"/);
    assert.match(html, /aria-colcount="1"/);
    assert.match(html, /aria-rowindex="2"/);
    assert.match(html, /data-ui-virtualized="true"/);
    assert.match(html, new RegExp(`height:\\s*${(rowHeight ?? 48) * 10000}px`));
    assert.doesNotMatch(html, />Member 9999</);
    assert.doesNotMatch(html, /<table|rowHeight=|headingHeight=|initialSize=/);
  });
}

test("table SSR: false opt-in preserves ordinary markup in data and compound forms", async () => {
  const normalize = (html: string) => html.replace(/rvs\d+/g, "rv-id");
  for (const compound of [false, true]) {
    const output = (optOut: boolean) =>
      renderToString(() => {
        const props = optOut ? { virtualized: false, rowHeight: 99, headingHeight: 80, initialSize: { width: 300, height: 180 } } : {};
        return compound ? (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Plain" {...props}>
                <Table.Header>
                  <Table.Column id="name" isRowHeader>
                    Name
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  <Table.Row id="a">
                    <Table.Cell>Alpha</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        ) : (
          <Table aria-label="Plain" columns={[{ id: "name", name: "Name", isRowHeader: true }]} items={[{ id: "a", name: "Alpha" }]} {...props} />
        );
      });
    assert.equal(normalize(await output(true)), normalize(await output(false)));
  }
});
