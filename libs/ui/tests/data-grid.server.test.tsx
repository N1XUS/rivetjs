// Server-target suite: `DataGrid` (Rivet addition: `@rivetjs/cdk/data-grid` behaviour, HeroUI table look; feature set
// inspired by HeroUI Pro's public docs, independent implementation). SSR — vendored `table*` + `data-grid*` classes per
// part, variants, `class` merged, checkbox / sort-indicator / expand defaults (lucide icons), load-more spinner, footer.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { DataGrid } from "../index.ts";

interface Row {
  id: number;
  name: string;
  role: string;
  kids?: Row[];
}
const rows: Row[] = [
  { id: 1, name: "Ada", role: "Engineer", kids: [{ id: 11, name: "Ada Jr", role: "Intern" }] },
  { id: 2, name: "Grace", role: "Admiral" },
];

const Fixture = (props: { variant?: "primary" | "secondary" }) => {
  const columns = [
    { id: "name", header: "Name", accessorKey: "name" as const, allowsSorting: true },
    { id: "role", header: "Role", accessorKey: "role" as const, align: "end" as const },
  ];
  return (
    <DataGrid<Row>
      aria-label="People"
      variant={props.variant}
      class="my-grid"
      data={rows}
      columns={columns}
      selectionMode="multiple"
      showSelectionCheckboxes
      defaultSelectedKeys={new Set([2])}
      defaultSortDescriptor={{ column: "name", direction: "ascending" }}
      getChildren={(r) => r.kids}
      allowsColumnResize
      onLoadMore={() => {}}
      footer={<span id="foot">2 people</span>}
    />
  );
};

test("data-grid SSR: classes per part, primary default, class merged", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /class="table-root data-grid table-root--primary my-grid"/);
  assert.match(html, /data-slot="data-grid"/);
  assert.match(html, /class="table__scroll-container data-grid__scroll-container"/);
  assert.match(
    html,
    /<table[^>]*class="table__content data-grid__content"[^>]*role="treegrid"|<table[^>]*role="treegrid"[^>]*class="table__content data-grid__content"/,
  );
  assert.match(html, /<thead class="table__header"/);
  assert.match(html, /class="table__column data-grid__column"/);
  assert.match(html, /<tbody class="table__body"/);
  assert.match(html, /class="table__row data-grid__row"/);
  assert.match(html, /class="table__cell data-grid__cell"/);
  assert.match(html, /class="table__column-resizer"/);
  assert.match(html, /class="table__footer"><span id="foot">2 people<\/span>/);
});

test("data-grid SSR: secondary variant", async () => {
  assert.match(await renderToString(() => <Fixture variant="secondary" />), /class="table-root data-grid table-root--secondary my-grid"/);
});

test("data-grid SSR: default checkbox, sort indicator, expand toggle, load-more spinner", async () => {
  const html = await renderToString(() => <Fixture />);
  // select-all (mixed: one of two rows) + row checkboxes in the HeroUI checkbox look
  assert.match(html, /<span[^>]*class="checkbox checkbox--primary data-grid__checkbox"[^>]*data-rv-select-all=""/);
  assert.match(html, /class="checkbox__control" data-slot="checkbox-control"/);
  assert.match(html, /data-slot="checkbox-default-indicator--indeterminate"/);
  assert.match(html, /data-slot="checkbox-default-indicator--checkmark"/);
  // sort indicator on the sorted column
  assert.match(html, /class="table__sortable-column-indicator data-grid__sort-indicator" data-direction="ascending"/);
  // expand toggle + chevron
  assert.match(html, /<button[^>]*class="data-grid__expand"[^>]*data-rv-expand=""/);
  assert.match(html, /lucide-chevron-right|data-lucide="chevron-right"|<svg/);
  // load more: spinner inside the vendored load-more classes
  assert.match(html, /class="table__load-more"/);
  assert.match(html, /class="table__load-more-content"/);
  assert.match(html, /data-slot="spinner"/);
});
