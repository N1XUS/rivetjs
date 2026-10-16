import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: Data",
  summary: "Rivet addition: `columns` + `items` on the root render the scroll container, header (sortable columns) and rows for you.",
  tags: ["table"],
  status: "experimental",
  frame: { height: 313, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["tbody tr:nth-child(1)", "Emily Davis"] },
    { click: "thead th:nth-child(1)" },
    { matches: "thead th:nth-child(1)[aria-sort=descending]" },
    { expect: ["tbody tr:nth-child(1)", "Sara Johnson"] },
  ],
});
