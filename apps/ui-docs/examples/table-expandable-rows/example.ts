import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: Expandable Rows",
  summary: 'Table demo "Expandable Rows".',
  tags: ["table"],
  status: "experimental",
  frame: { height: 259, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["tbody", "Project"] },
    { absent: "tbody tr[data-key='3']" },
    { click: "tbody tr[data-key='2'] [slot=chevron]" },
    { matches: "tbody tr[data-key='2'][aria-expanded=true]" },
    { expect: ["tbody", "Weekly Report"] },
  ],
});
