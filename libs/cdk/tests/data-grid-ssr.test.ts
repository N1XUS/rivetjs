// Rivet-authored: server rendering of `@rivetjs/cdk/data-grid` in resume mode (`tests/server.ts`): grid markup, first
// virtual window only, sorted / selected server state, resumable handler entries (no "not serializable" errors).
import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";
import { importModule, renderHtml } from "./server.ts";

const { window } = installDom();

const fixture = await importModule<{ Plain(): unknown; Virtual(): unknown; Tree(): unknown; Rendered(): unknown }>(
  "data-grid-fixture.tsx",
  `
import { signal } from "@rivetjs/reactivity";
import { DataGrid } from "@rivetjs/cdk/data-grid";

const people = [
  { id: 1, name: "Charlie", age: 34 },
  { id: 2, name: "alice", age: 28 },
  { id: 3, name: "Bob", age: 45 },
];

export function Plain() {
  const selected = signal(new Set([2]));
  const columns = [
    { id: "name", header: "Name", accessorKey: "name", allowsSorting: true, width: 160, pinned: "start" },
    { id: "age", header: "Age", accessorKey: "age", allowsSorting: true, cell: (p) => <b>{p.age} y</b> },
  ];
  return (
    <DataGrid
      aria-label="People"
      data={people}
      columns={columns}
      selectionMode="multiple"
      showSelectionCheckboxes
      selectedKeys={selected}
      defaultSortDescriptor={{ column: "name", direction: "ascending" }}
      allowsColumnResize
      onRowAction={(key) => console.info(key)}
      footer={<span id="foot">3 people</span>}
    />
  );
}

const many = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: "Row " + i, age: i % 80 }));
export function Virtual() {
  return <DataGrid aria-label="Many" data={many} columns={[{ id: "name", header: "Name", accessorKey: "name" }, { id: "age", header: "Age", accessorKey: "age" }]} virtualized rowHeight={40} height={400} overscan={4} />;
}

export function Rendered() {
  const columns = [{ id: "name", header: (info) => <i data-h={info.sortDirection() ?? "none"}>Name</i>, accessorKey: "name", allowsSorting: true }];
  return (
    <DataGrid
      aria-label="Rendered"
      data={tree}
      columns={columns}
      getChildren={(r) => r.children}
      selectionMode="multiple"
      showSelectionCheckboxes
      defaultSortDescriptor={{ column: "name", direction: "descending" }}
      renderCheckbox={(state) => <b data-on={state.isSelected() ? "1" : "0"} data-mixed={state.isIndeterminate() ? "1" : "0"} />}
      renderSortIndicator={(direction) => <u data-dir={direction()} />}
      renderExpandIcon={(open) => <s data-open={open() ? "1" : "0"} />}
    />
  );
}

const tree = [{ id: "a", name: "A", age: 1, children: [{ id: "a1", name: "A1", age: 2 }] }, { id: "b", name: "B", age: 3 }];
export function Tree() {
  return <DataGrid aria-label="Tree" data={tree} columns={[{ id: "name", header: "Name", accessorKey: "name" }]} getChildren={(r) => r.children} defaultExpandedKeys={["a"]} />;
}
`,
);

const parse = (html: string) => {
  const host = window.document.createElement("div");
  host.innerHTML = html;
  return host;
};

describe("DataGrid SSR", () => {
  test("grid markup, server sort + selection, pinned cells, footer", async () => {
    const host = parse(await renderHtml(() => fixture.Plain()));
    const table = host.querySelector("table")!;
    assert.equal(table.getAttribute("role"), "grid");
    assert.equal(table.getAttribute("aria-multiselectable"), "true");
    assert.equal(table.getAttribute("aria-rowcount"), "4");
    const rows = [...host.querySelectorAll("tbody > tr[data-key]")];
    assert.deepEqual(
      rows.map((r) => r.querySelector("[data-column=name]")!.textContent),
      ["alice", "Bob", "Charlie"],
    );
    assert.equal(rows[0]!.getAttribute("aria-selected"), "true");
    assert.equal(rows[1]!.getAttribute("aria-selected"), "false");
    assert.equal(rows[0]!.getAttribute("data-key-type"), "number");
    assert.equal(host.querySelector("thead [data-column=name]")!.getAttribute("aria-sort"), "ascending");
    assert.equal(host.querySelector("[data-rv-select-all]")!.getAttribute("aria-checked"), "mixed");
    assert.match(host.querySelector("tbody [data-column=name]")!.getAttribute("style") ?? "", /position: ?sticky/);
    assert.ok(host.querySelector("[data-rv-resizer=age]"));
    assert.equal(rows[0]!.querySelector("[data-column=age] b")!.textContent, "28 y");
    assert.ok(host.querySelector(".rv-DataGrid-footer #foot"));
    assert.equal(host.querySelector(".rv-DataGrid")!.getAttribute("preload"), null);
  });

  test("virtualized: only the first window is rendered", async () => {
    const html = await renderHtml(() => fixture.Virtual());
    const host = parse(html);
    const rows = host.querySelectorAll("tbody > tr[data-key]");
    assert.equal(rows.length, 14);
    assert.equal(host.querySelector("table")!.getAttribute("aria-rowcount"), "5001");
    const spacer = host.querySelector("tbody > tr[data-rv-spacer] td")!;
    assert.match(spacer.getAttribute("style") ?? "", /height: ?199440px/);
    // The full data set is the grid's state (serialized once), not 5000 rendered rows.
    assert.ok(html.length < 400_000, `html ${html.length}`);
  });

  test("render props get resumable accessors (bindings over them serialize)", async () => {
    const host = parse(await renderHtml(() => fixture.Rendered()));
    assert.equal(host.querySelector("u")!.getAttribute("data-dir"), "descending");
    assert.equal(host.querySelector("i")!.getAttribute("data-h"), "descending");
    assert.equal(host.querySelectorAll("b").length, 3);
    assert.equal(host.querySelector("s")!.getAttribute("data-open"), "0");
  });

  test("treegrid with expanded rows", async () => {
    const host = parse(await renderHtml(() => fixture.Tree()));
    assert.equal(host.querySelector("table")!.getAttribute("role"), "treegrid");
    const rows = [...host.querySelectorAll("tbody > tr[data-key]")];
    assert.deepEqual(
      rows.map((r) => [r.getAttribute("data-key"), r.getAttribute("aria-level"), r.getAttribute("aria-expanded")]),
      [
        ["a", "1", "true"],
        ["a1", "2", null],
        ["b", "1", null],
      ],
    );
  });
});
