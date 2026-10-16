import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: Sorting",
  summary: 'Table demo "Sorting".',
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
