import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid",
  summary: "Sortable, selectable, resizable grid from data + column definitions, styled with plain CSS on the rv-DataGrid* classes and data attributes.",
  tags: ["data-grid", "table", "grid", "css"],
  status: "experimental",
  frame: { height: 340, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["tbody tr[data-key='1'] [data-column=name]", "Mercury"] },
    { click: "thead th[data-column=moons]" },
    { matches: 'thead th[data-column=moons][aria-sort="ascending"]' },
    { click: "[data-rv-select-all]" },
    { expect: ["#planets-selected", "All selected"] },
  ],
});
