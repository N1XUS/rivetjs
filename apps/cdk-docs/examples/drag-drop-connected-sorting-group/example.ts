import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: connected lists in a group",
  summary: "Port of the Angular CDK connected sorting group example: a DropListGroup connects every DropList inside it.",
  tags: ["cdk", "drag-drop", "connected"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#todo-list > #get-to-work:first-child" }, { matches: "#done-list > #get-up:first-child" }],
});
