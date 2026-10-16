// DOM-target suite: `DataGrid` (Rivet addition: `@rivetjs/cdk/data-grid` behaviour, HeroUI table look) on happy-dom:
// index exports, classes per part, default parts react to state (select-all → every checkbox checked, sort indicator
// direction, expand chevron state), custom `render*` props replace the defaults. Keyboard / pointer / virtual scroll:
// cdk Chromium suite (`libs/cdk/tests/data-grid.browser.test.tsx`) + resumed story (`tests-components/data-grid.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { DataGrid, dataGridVariants } = await import("../src/components/data-grid/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));

interface Row {
  id: number;
  name: string;
  kids?: Row[];
}
const data: Row[] = [
  { id: 1, name: "b", kids: [{ id: 3, name: "c" }] },
  { id: 2, name: "a" },
];
const columns = [{ id: "name", header: "Name", accessorKey: "name" as const, allowsSorting: true }];

test("data-grid: exports + slot classes", () => {
  assert.equal(typeof DataGrid, "function");
  const s = dataGridVariants({ variant: "secondary" });
  assert.equal(s.base(), "table-root data-grid table-root--secondary");
  assert.equal(s.cell(), "table__cell data-grid__cell");
  assert.equal(s.checkbox(), "checkbox checkbox--primary data-grid__checkbox");
});

test("data-grid: select-all checks every row checkbox; sort indicator follows the sort", async () => {
  const r = render(() => <DataGrid<Row> aria-label="G" data={data} columns={columns} selectionMode="multiple" showSelectionCheckboxes />);
  const el = r.container as HTMLElement;
  assert.ok(el.querySelector(".table-root.data-grid.table-root--primary"));
  const all = el.querySelector("[data-rv-select-all]") as HTMLElement;
  assert.equal(all.className, "checkbox checkbox--primary data-grid__checkbox");
  assert.equal(all.getAttribute("aria-checked"), "false");
  all.click();
  await flush();
  assert.equal(all.getAttribute("aria-checked"), "true");
  assert.equal(all.getAttribute("data-selected"), "true");
  const boxes = [...el.querySelectorAll("[data-rv-select]")];
  assert.equal(boxes.length, 2);
  for (const b of boxes) assert.equal(b.getAttribute("data-selected"), "true");
  assert.equal(el.querySelector('[data-rv-select] [data-slot="checkbox-default-indicator--checkmark"]')?.getAttribute("stroke-dashoffset"), "48");

  const indicator = el.querySelector(".data-grid__sort-indicator") as HTMLElement;
  assert.equal(indicator.getAttribute("data-direction"), null);
  (el.querySelector("th[data-column=name]") as HTMLElement).click();
  await flush();
  assert.equal(indicator.getAttribute("data-direction"), "ascending");
  assert.deepEqual(
    [...el.querySelectorAll("tbody tr[data-key] [data-column=name]")].map((c) => c.textContent),
    ["a", "b"],
  );
  r.unmount();
});

test("data-grid: expand toggle shows children; custom render props replace defaults", async () => {
  const r = render(() => (
    <DataGrid<Row>
      aria-label="T"
      data={data}
      columns={columns}
      getChildren={(x) => x.kids}
      renderExpandIcon={(open) => <i class="my-chevron" data-open={open() ? "yes" : "no"} />}
      renderSortIndicator={() => <b class="my-sort" />}
    />
  ));
  const el = r.container as HTMLElement;
  assert.ok(el.querySelector(".my-sort"));
  assert.equal(el.querySelector(".data-grid__sort-indicator"), null);
  const toggle = el.querySelector("[data-rv-expand]") as HTMLElement;
  assert.equal(toggle.className, "data-grid__expand");
  assert.equal(el.querySelector(".my-chevron")?.getAttribute("data-open"), "no");
  assert.equal(el.querySelectorAll("tbody tr[data-key]").length, 2);
  toggle.click();
  await flush();
  assert.equal(el.querySelector(".my-chevron")?.getAttribute("data-open"), "yes");
  assert.equal(toggle.getAttribute("data-expanded"), "true");
  assert.equal(el.querySelectorAll("tbody tr[data-key]").length, 3);
  r.unmount();
});
