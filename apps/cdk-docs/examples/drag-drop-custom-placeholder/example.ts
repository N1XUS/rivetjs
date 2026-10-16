import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: custom placeholder",
  summary: "Port of the Angular CDK custom placeholder example: a DragPlaceholder marks the drop slot instead of a clone of the item.",
  tags: ["cdk", "drag-drop", "placeholder"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#movie-0 > template[data-rv-drag-placeholder]" }, { absent: "#movies .example-custom-placeholder" }],
});
