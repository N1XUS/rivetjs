import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: Usage",
  summary: 'Table demo "Usage".',
  tags: ["table"],
  status: "experimental",
  frame: { height: 268, auto: true },
  show: ["src/routes/index.tsx"],
  // Static table (TABLE-NATIVE): native markup, no JavaScript before or after the input below.
  test: [
    { matches: "table[aria-label='Team members']:not([role]) tbody th[scope=row]" },
    { hover: "tbody tr:nth-child(2)" },
    { click: "tbody tr:nth-child(2) td" },
    { key: "Tab" },
    { expect: ["tbody th[scope=row]", "Kate Moore"] },
  ],
});
