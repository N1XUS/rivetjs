import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: sort predicate",
  summary: "Port of the Angular CDK sort predicate example: sortPredicate only lets even numbers sort into even positions and odd numbers into odd ones.",
  tags: ["cdk", "drag-drop", "sorting", "predicate"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#numbers > #n1:first-child" }, { matches: "#numbers > #n8:last-child" }],
});
