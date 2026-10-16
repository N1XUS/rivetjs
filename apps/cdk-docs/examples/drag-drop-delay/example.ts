import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: delayed dragging",
  summary: "Port of the Angular CDK delay example: dragStartDelay waits for the pointer to be held down for one second before the drag starts.",
  tags: ["cdk", "drag-drop"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#box.cdk-drag" }],
});
