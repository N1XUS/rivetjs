// DOM-target suite: `Table` (upstream tests/components/table/table.test.tsx ported to happy-dom): shell slots + grid role, row
// selection through the selection checkbox, sort toggle through the column header (SortableColumnHeader), typeahead from
// non-editable cells; keyboard typing inside editable cells (`tab` navigation keeps it in the cell) runs in Chromium
// (`tests-components/table.test.ts`: real key defaults).
// Rivet: `@react-aria/test-utils` Table tester / user-event → direct pointer / key events; fake timers → `flush()`; part classes,
// variant, SortableColumnHeader indicator (default lucide chevron, custom, hidden), dynamic body `items` + `Table.Collection`,
// Footer / ResizableContainer / LoadMore parts, parts outside a Table, live `class`, index exports.
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Checkbox } = await import("../src/components/checkbox/index.ts");
const T = await import("../src/components/table/index.ts");
const { Table } = T;
type Selection = "all" | Set<string | number>;
type SortDescriptor = { column: string | number; direction: "ascending" | "descending" };

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
function key(el: Element, k: string) {
  el.dispatchEvent(new W.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  el.dispatchEvent(new W.KeyboardEvent("keyup", { key: k, bubbles: true, cancelable: true }));
}
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const qa = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];

let unmount: (() => void) | undefined;
const mount = (fn: () => unknown) => {
  const r = render(fn as never);
  unmount = r.unmount;
  return r;
};
afterEach(() => {
  unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

const rows = [
  { id: "1", name: "Kate", role: "CEO" },
  { id: "2", name: "John", role: "CTO" },
  { id: "3", name: "Sara", role: "CMO" },
];

const SelectionBox = (props: { label: string }) => (
  <Checkbox aria-label={props.label} slot="selection">
    <Checkbox.Content>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
    </Checkbox.Content>
  </Checkbox>
);

const renderTable = (
  props: { onSelectionChange?: (keys: Selection) => void; sortDescriptor?: SortDescriptor; onSortChange?: (d: SortDescriptor) => void } = {},
) =>
  mount(() => (
    <Table data-testid="table">
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Team"
          selectionMode="multiple"
          sortDescriptor={props.sortDescriptor}
          onSelectionChange={props.onSelectionChange as never}
          onSortChange={props.onSortChange as never}
        >
          <Table.Header>
            <Table.Column>
              <SelectionBox label="Select all" />
            </Table.Column>
            <Table.Column allowsSorting isRowHeader id="name">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Member</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column id="role">Role</Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row id={row.id}>
                <Table.Cell>
                  <SelectionBox label={`Select ${row.name}`} />
                </Table.Cell>
                <Table.Cell>{row.name}</Table.Cell>
                <Table.Cell>{row.role}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  ));

test("table: index exports", () => {
  assert.equal(Table, T.TableRoot);
  assert.equal(Table.Root, T.TableRoot);
  for (const [k, v] of Object.entries({
    Body: T.TableBody,
    Cell: T.TableCell,
    Collection: T.TableCollection,
    Column: T.TableColumn,
    ColumnResizer: T.TableColumnResizer,
    Content: T.TableContent,
    Footer: T.TableFooter,
    Header: T.TableHeader,
    LoadMore: T.TableLoadMoreItem,
    LoadMoreContent: T.TableLoadMoreContent,
    ResizableContainer: T.TableResizableContainer,
    Row: T.TableRow,
    ScrollContainer: T.TableScrollContainer,
    SortableColumnHeader: T.TableSortableColumnHeader,
  }))
    assert.equal((Table as unknown as Record<string, unknown>)[k], v, k);
  assert.equal(T.tableVariants().base(), "table-root table-root--primary");
});

test("table (upstream): exposes shell slots and grid role", () => {
  renderTable();
  const root = q("[data-testid=table]")!;
  assert.equal(root.getAttribute("data-slot"), "table");
  assert.match(root.className, /\btable-root\b/);
  assert.ok(q('[data-slot="table-scroll-container"]'));
  assert.ok(q('[data-slot="table-content"]'));
  const grid = q("table")!;
  assert.equal(grid.getAttribute("role"), "grid");
  assert.equal(grid.getAttribute("aria-label"), "Team");
  assert.ok(q('[data-slot="table-header"]'));
  assert.ok(q('[data-slot="table-body"]'));
  assert.ok(q('[data-slot="table-row"]'));
  assert.ok(q('[data-slot="table-cell"]'));
});

test("table: part classes (BEM) + variants", () => {
  renderTable();
  assert.equal(q("[data-testid=table]")!.className, "table-root table-root--primary");
  assert.equal(q('[data-slot="table-scroll-container"]')!.className, "table__scroll-container");
  assert.match(q("table")!.className, /^table__content\b/);
  assert.match(q("thead")!.className, /^table__header\b/);
  assert.match(q("th")!.className, /^table__column\b/);
  assert.match(q("tbody")!.className, /^table__body\b/);
  assert.match(q("tbody tr")!.className, /^table__row\b/);
  assert.match(q("tbody td")!.className, /^table__cell\b/);
  unmount?.();
  mount(() => (
    <Table variant="secondary" data-testid="t2">
      <Table.Content aria-label="x">
        <Table.Header>
          <Table.Column isRowHeader>A</Table.Column>
        </Table.Header>
        <Table.Body>
          <Table.Row id="r">
            <Table.Cell>a</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Content>
    </Table>
  ));
  assert.equal(q("[data-testid=t2]")!.className, "table-root table-root--secondary");
});

test("table: keyboardNavigationBehavior defaults to tab (HeroUI)", () => {
  renderTable();
  // `tab` navigation: cells are focusable themselves (focusMode cell), the selection checkbox is reached with Tab.
  assert.equal(q("tbody td")!.getAttribute("tabindex"), "-1");
});

test("table (upstream): supports toggling row selection", async () => {
  const calls: Selection[] = [];
  renderTable({ onSelectionChange: (keys) => calls.push(keys) });
  const row = qa("tbody tr").find((r) => r.textContent!.includes("John"))!;
  press(row.querySelector("input[type=checkbox]")!);
  await flush();
  assert.ok(calls.length > 0);
  const selection = calls[0]!;
  assert.deepEqual(selection === "all" ? null : [...selection], ["2"]);
  assert.equal(row.getAttribute("aria-selected"), "true");
});

test("table (upstream): supports toggling sort", async () => {
  const calls: SortDescriptor[] = [];
  renderTable({ sortDescriptor: { column: "name", direction: "ascending" }, onSortChange: (d) => calls.push(d) });
  const header = q('[data-slot="table-sortable-column-header"]')!;
  assert.ok(header);
  assert.equal(header.getAttribute("data-direction"), "ascending");
  const indicator = header.querySelector('[data-slot="table-sortable-column-indicator"]')!;
  assert.equal(indicator.getAttribute("data-direction"), "ascending");
  assert.match(indicator.getAttribute("class") ?? "", /table__sortable-column-indicator/);
  assert.equal(indicator.querySelector("path")!.getAttribute("d"), "m18 15-6-6-6 6");
  press(header.closest("th")!);
  await flush();
  assert.ok(calls.length > 0);
  assert.equal(calls[0]!.column, "name");
});

test("table: SortableColumnHeader follows a two-way sortDescriptor signal; custom / hidden indicator", async () => {
  const sort = signal<SortDescriptor | null>({ column: "name", direction: "ascending" });
  mount(() => (
    <Table>
      <Table.Content aria-label="Sorted" sortDescriptor={sort as never}>
        <Table.Header>
          <Table.Column allowsSorting isRowHeader id="name">
            {({ sortDirection }) => (
              <Table.SortableColumnHeader sortDirection={sortDirection()} indicator={(d) => <b class="ind">{d}</b>}>
                Name
              </Table.SortableColumnHeader>
            )}
          </Table.Column>
          <Table.Column allowsSorting id="role">
            {({ sortDirection }) => (
              <Table.SortableColumnHeader sortDirection={sortDirection} showIndicator={false}>
                Role
              </Table.SortableColumnHeader>
            )}
          </Table.Column>
        </Table.Header>
        <Table.Body>
          <Table.Row id="r">
            <Table.Cell>a</Table.Cell>
            <Table.Cell>b</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Content>
    </Table>
  ));
  const [name, role] = qa('[data-slot="table-sortable-column-header"]');
  assert.equal(name!.querySelector(".ind")!.textContent, "ascending");
  assert.equal(name!.querySelector(".ind")!.parentElement!.getAttribute("data-slot"), "table-sortable-column-indicator");
  press(name!.closest("th")!);
  await flush();
  assert.deepEqual(sort(), { column: "name", direction: "descending" });
  assert.equal(name!.getAttribute("data-direction"), "descending");
  assert.equal(name!.querySelector(".ind")!.textContent, "descending");
  press(role!.closest("th")!);
  await flush();
  assert.equal(role!.getAttribute("data-direction"), "ascending");
  assert.equal(role!.querySelector('[data-slot="table-sortable-column-indicator"]'), null);
  assert.equal(name!.getAttribute("data-direction"), null);
});

test("table (upstream): supports typeahead from non-editable cells", async () => {
  mount(() => (
    <Table>
      <Table.Content aria-label="Editable values">
        <Table.Header>
          <Table.Column isRowHeader>Name</Table.Column>
          <Table.Column>Value</Table.Column>
        </Table.Header>
        <Table.Body>
          <Table.Row id="alpha">
            <Table.Cell>Alpha</Table.Cell>
            <Table.Cell>1</Table.Cell>
          </Table.Row>
          <Table.Row id="year-range">
            <Table.Cell>Year Range</Table.Cell>
            <Table.Cell>2020–2026</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Content>
    </Table>
  ));
  const alpha = qa("[role=rowheader]").find((c) => c.textContent === "Alpha")!;
  const year = qa("[role=rowheader]").find((c) => c.textContent === "Year Range")!;
  press(alpha);
  alpha.focus();
  await flush();
  assert.equal(document.activeElement, alpha);
  key(alpha, "y");
  await flush();
  assert.equal(document.activeElement, year);
});

test("table: dynamic body items + Table.Collection cells, Footer, LoadMore, ResizableContainer + ColumnResizer", async () => {
  const columns = [
    { id: "name", name: "Name" },
    { id: "role", name: "Role" },
  ];
  const items = signal(rows);
  mount(() => (
    <Table>
      <Table.ResizableContainer class="rc">
        <Table.Content aria-label="Dynamic">
          <Table.Header columns={columns}>
            {(column: { id: string; name: string }) => (
              <Table.Column id={column.id} isRowHeader={column.id === "name"}>
                {column.name}
                <Table.ColumnResizer />
              </Table.Column>
            )}
          </Table.Header>
          <Table.Body items={items}>
            {(row: (typeof rows)[number]) => (
              <Table.Row id={row.id} columns={columns}>
                <Table.Collection items={columns}>{(column: { id: string }) => <Table.Cell>{row[column.id as "name" | "role"]}</Table.Cell>}</Table.Collection>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ResizableContainer>
      <Table.Footer>
        <span>3 members</span>
      </Table.Footer>
    </Table>
  ));
  assert.equal(qa("tbody tr").length, 3);
  assert.deepEqual(
    qa("tbody tr").map((r) => r.textContent),
    ["KateCEO", "JohnCTO", "SaraCMO"],
  );
  assert.equal(q('[data-slot="table-resizable-container"]')!.className, "table__resizable-container rc");
  assert.equal(qa('[data-slot="table-column-resizer"]').length, 2);
  assert.match(q('[data-slot="table-column-resizer"]')!.className, /^table__column-resizer\b/);
  assert.equal(q('[data-slot="table-footer"]')!.className, "table__footer");
  items.set([...rows, { id: "4", name: "Ana", role: "CFO" }]);
  await flush();
  assert.equal(qa("tbody tr").length, 4);
});

test("table: LoadMore + LoadMoreContent classes", () => {
  mount(() => (
    <Table>
      <Table.Content aria-label="Loading">
        <Table.Header>
          <Table.Column isRowHeader>Name</Table.Column>
        </Table.Header>
        <Table.Body>
          <Table.Row id="a">
            <Table.Cell>A</Table.Cell>
          </Table.Row>
          <Table.LoadMore isLoading onLoadMore={() => {}}>
            <Table.LoadMoreContent>Loading…</Table.LoadMoreContent>
          </Table.LoadMore>
        </Table.Body>
      </Table.Content>
    </Table>
  ));
  const more = q('[data-slot="table-load-more"]')!;
  assert.ok(more);
  assert.match(more.className, /\btable__load-more\b/);
  assert.equal(q('[data-slot="table-load-more-content"]')!.className, "table__load-more-content");
  assert.equal(q('[data-slot="table-load-more-content"]')!.textContent, "Loading…");
});

test("table: live class on a cdk part updates in place", async () => {
  const extra = signal("a");
  mount(() => (
    <Table>
      <Table.Content aria-label="Live">
        <Table.Header>
          <Table.Column isRowHeader>Name</Table.Column>
        </Table.Header>
        <Table.Body>
          <Table.Row id="a" class={`x-${extra()}`}>
            <Table.Cell>A</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Content>
    </Table>
  ));
  const row = q("tbody tr")!;
  assert.match(row.className, /\bx-a\b/);
  extra.set("b");
  await flush();
  assert.equal(q("tbody tr"), row);
  assert.match(row.className, /\bx-b\b/);
  assert.match(row.className, /\btable__row\b/);
});

test("table: parts outside a Table keep only the caller's class", () => {
  mount(() => (
    <div>
      <Table.ScrollContainer class="s" />
      <Table.Footer class="f" />
      <Table.SortableColumnHeader class="h" sortDirection="ascending">
        X
      </Table.SortableColumnHeader>
    </div>
  ));
  assert.equal(q('[data-slot="table-scroll-container"]')!.className, "s");
  assert.equal(q('[data-slot="table-footer"]')!.className, "f");
  assert.equal(q('[data-slot="table-sortable-column-header"]')!.className, "h");
});

// Rivet auto form (identity spec §4.2): root `columns` + `items` render the shell, header and default cells.
const mask = (html: string) => html.replace(/ (id|aria-labelledby|aria-describedby|aria-controls|data-collection|data-key)="[^"]*"/g, "");
const autoColumns = [
  { id: "name", name: "Member", isRowHeader: true, allowsSorting: true },
  { id: "role", name: "Role" },
];

test("table auto form: columns + items match the compound form", () => {
  const sort: SortDescriptor = { column: "name", direction: "ascending" };
  mount(() => (
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
      <Table.Footer>3 members</Table.Footer>
    </Table>
  ));
  const before = mask(document.body.innerHTML);
  unmount?.();
  document.body.innerHTML = "";
  mount(() => <Table aria-label="Team" columns={autoColumns} footer="3 members" items={rows} sortDescriptor={sort} />);
  assert.equal(mask(document.body.innerHTML), before);
  assert.equal(qa('[data-slot="table-row"]').length, 3);
  assert.equal(q('[role="grid"]')!.getAttribute("aria-label"), "Team");
});

test("table auto form: row renderer, sort + selection props reach the content", async () => {
  const calls: SortDescriptor[] = [];
  const picked: Selection[] = [];
  mount(() => (
    <Table
      aria-label="Team"
      class="extra"
      columns={autoColumns}
      items={rows}
      selectionMode="single"
      sortDescriptor={{ column: "name", direction: "descending" }}
      onSelectionChange={(k) => picked.push(k as Selection)}
      onSortChange={(d) => calls.push(d as SortDescriptor)}
    >
      {(row: (typeof rows)[number]) => (
        <Table.Row id={row.id}>
          <Table.Cell>{row.name.toUpperCase()}</Table.Cell>
          <Table.Cell>{row.role}</Table.Cell>
        </Table.Row>
      )}
    </Table>
  ));
  assert.match(q('[data-slot="table"]')!.className, /extra/);
  assert.equal(q('[role="grid"]')!.getAttribute("class")?.includes("extra"), false);
  assert.equal(q('[data-slot="table-row"] [data-slot="table-cell"]')!.textContent, "KATE");
  assert.equal(q('[data-slot="table-sortable-column-header"]')!.getAttribute("data-direction"), "descending");
  press(q('[data-slot="table-sortable-column-header"]')!.closest("th")!);
  await flush();
  assert.equal(calls[0]!.column, "name");
  press(qa('[data-slot="table-row"]')[1]!);
  await flush();
  assert.deepEqual([...(picked[0] as Set<string>)], ["2"]);
});

test("table auto form: aria-label without columns wraps header/body children", () => {
  mount(() => (
    <Table aria-label="Plain">
      <Table.Header>
        <Table.Column isRowHeader>Name</Table.Column>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell>Kate</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ));
  assert.ok(q('[data-slot="table"] > .table__scroll-container > table[role="grid"]'));
  assert.equal(q('[role="grid"]')!.getAttribute("aria-label"), "Plain");
});

// TABLE-NATIVE: a proven static call site (`$native: 1`, compiler-injected) renders native table markup in the browser
// too (a client render or an ancestor's adopt run): row headers by column index, a live `class` from the caller's own
// binding still updates (the caller owns its expressions), and the auto form.
test("table native (DOM): semantic markup, row headers, caller bindings", () => {
  const NATIVE = { $native: 1 } as {};
  const label = signal("Kate");
  mount(() => (
    <>
      <Table {...NATIVE}>
        <Table.ScrollContainer>
          <Table.Content aria-label="Team">
            <Table.Header>
              <Table.Column>Role</Table.Column>
              <Table.Column isRowHeader>Name</Table.Column>
            </Table.Header>
            <Table.Body>
              <Table.Row>
                <Table.Cell>CEO</Table.Cell>
                <Table.Cell>{label()}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>CTO</Table.Cell>
                <Table.Cell>John</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <Table {...NATIVE} aria-label="Auto" columns={[{ id: "name", name: "Name", isRowHeader: true }]} items={rows} />
    </>
  ));
  assert.equal(qa('[role="grid"], [tabindex]').length, 0);
  const tables = qa("table");
  assert.equal(tables.length, 2);
  assert.equal(tables[0]!.getAttribute("aria-label"), "Team");
  assert.deepEqual(
    [...tables[0]!.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.tagName + (c.getAttribute("scope") ?? "")).join()),
    ["TD,THrow", "TD,THrow"],
  );
  assert.equal(tables[0]!.querySelector("tbody th")!.textContent, "Kate");
  label.set("Kim");
  assert.equal(tables[0]!.querySelector("tbody th")!.textContent, "Kim");
  assert.deepEqual(
    [...tables[1]!.querySelectorAll("tbody th[scope=row]")].map((th) => th.textContent),
    rows.map((r) => r.name),
  );
  assert.equal(tables[1]!.getAttribute("aria-label"), "Auto");
});
