import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: disabled sorting",
  summary: "Port of the Angular CDK disabled sorting example: the first list has sortingDisabled, so its items keep their order but still move to the basket.",
  tags: ["cdk", "drag-drop", "connected", "sorting"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#items > #carrots:first-child" }, { matches: "#basket > #oranges:first-child" }],
});
