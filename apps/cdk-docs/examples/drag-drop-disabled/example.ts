import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: disabled dragging",
  summary: "Port of the Angular CDK disabled example: a Drag with disabled stays in place (cdk-drag-disabled); the others sort around it.",
  tags: ["cdk", "drag-drop", "disabled"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#second.cdk-drag-disabled" }, { attr: ["#second", "data-disabled", "true"] }, { matches: "#first:not(.cdk-drag-disabled)" }],
});
