import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: custom preview",
  summary:
    "Port of the Angular CDK custom preview example: a DragPreview replaces the dragged clone (a poster card here instead of the upstream Wikimedia posters).",
  tags: ["cdk", "drag-drop", "preview"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#movie-0 > template[data-rv-drag-preview]" }, { absent: "#movies .example-poster" }],
});
