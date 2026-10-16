import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: Pagination",
  summary: 'Table demo "Pagination".',
  tags: ["table"],
  status: "experimental",
  frame: { height: 316, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["tbody tr:nth-child(1)", "Kate Moore"] },
    { click: "[data-slot=pagination-link]:not([aria-current])" },
    { expect: ["tbody tr:nth-child(1)", "Emily Davis"] },
  ],
});
