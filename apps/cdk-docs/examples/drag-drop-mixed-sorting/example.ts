import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: wrapping list (mixed orientation)",
  summary: 'Port of the Angular CDK mixed sorting example: orientation="mixed" sorts a wrapping list by moving the items in the DOM.',
  tags: ["cdk", "drag-drop", "sorting"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ attr: ["#items", "data-orientation", "mixed"] }, { matches: "#items > #zero:first-child" }],
});
