import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Custom Sort Function",
  summary: "`sortFn` orders a column by its own rule: status by severity, not alphabetically.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 364, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["tbody tr[data-key] [data-column=name]", "Celia Varga"],
    },
  ],
});
