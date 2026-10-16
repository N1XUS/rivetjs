import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: Selection",
  summary: 'Table demo "Selection".',
  tags: ["table"],
  status: "experimental",
  frame: { height: 300, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["p", "Selected: None"] },
    { click: "tbody tr:nth-child(2) label" },
    { expect: ["p", "Selected: 2"] },
    { matches: "tbody tr:nth-child(2)[aria-selected=true]" },
  ],
});
