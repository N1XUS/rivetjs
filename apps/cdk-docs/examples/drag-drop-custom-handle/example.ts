import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: drag handle",
  summary:
    "Port of the Angular CDK custom handle example: a DragHandle restricts dragging to the handle (lucide Move icon instead of the upstream inline SVG).",
  tags: ["cdk", "drag-drop", "handle"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#box > #handle.cdk-drag-handle svg" }],
});
