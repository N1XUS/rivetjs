import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: horizontal sorting",
  summary: 'Port of the Angular CDK horizontal sorting example: orientation="horizontal" sorts along the x axis.',
  tags: ["cdk", "drag-drop", "sorting"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ attr: ["#periods", "data-orientation", "horizontal"] }, { matches: "#periods > #period-0:first-child" }],
});
