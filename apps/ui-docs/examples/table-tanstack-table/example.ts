import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: TanStack Table",
  summary: 'Table demo "TanStack Table".',
  tags: ["table"],
  status: "experimental",
  frame: { height: 320, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["tbody tr:nth-child(1)", "Kate Moore"] },
    { click: "thead th:nth-child(1)" },
    { expect: ["tbody tr:nth-child(1)", "Davis Wilson"] },
    { click: "thead th:nth-child(1)" },
    { expect: ["tbody tr:nth-child(1)", "Sara Johnson"] },
    { click: "[data-slot=pagination-link]:not([aria-current])" },
    { expect: ["tbody tr:nth-child(1)", "John Smith"] },
    { expect: ["[data-slot=pagination-summary]", "5 to 8 of 8 results"] },
  ],
});
