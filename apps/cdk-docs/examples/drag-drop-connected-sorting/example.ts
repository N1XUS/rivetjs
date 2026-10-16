import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: transfer items between lists",
  summary: "Port of the Angular CDK connected sorting example: two DropLists connected by id (connectedTo); a drop into the other list transfers the item.",
  tags: ["cdk", "drag-drop", "connected"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#todo-list > #get-to-work:first-child" }, { matches: "#done-list > #get-up:first-child" }],
});
