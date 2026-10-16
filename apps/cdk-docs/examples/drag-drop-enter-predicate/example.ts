import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: enter predicate",
  summary: "Port of the Angular CDK enter predicate example: only even numbers may enter the second list, and nothing may return to the first.",
  tags: ["cdk", "drag-drop", "connected", "predicate"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#all > #n1:first-child" }, { matches: "#even > #n10" }],
});
