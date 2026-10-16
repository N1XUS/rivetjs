import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Expandable Rows",
  summary: "`getChildren` turns the grid into a treegrid: chevrons expand rows, ArrowRight / ArrowLeft expand and collapse.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 320, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["tbody tr[data-key='eng-apps'] [data-column=name]", "Applications"],
    },
  ],
});
