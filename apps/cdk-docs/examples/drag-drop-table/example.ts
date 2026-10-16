import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: sortable table rows",
  summary: "Port of the Angular Material table drag-drop example on a plain table: the tbody is the DropList, each tr a Drag locked to the y axis.",
  tags: ["cdk", "drag-drop", "table", "sorting"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#rows.cdk-drop-list > tr#row-H.cdk-drag:first-child" }, { matches: "table > thead + tbody#rows" }],
});
