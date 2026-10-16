import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: free dragging",
  summary: "Port of the Angular CDK overview example: a Drag outside any DropList moves freely; the engine keeps its position as a transform.",
  tags: ["cdk", "drag-drop"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#box.cdk-drag" }, { absent: "#box[style*='translate3d']" }],
});
