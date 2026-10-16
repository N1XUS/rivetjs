import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: boundary",
  summary: "Port of the Angular CDK boundary example: boundaryElement keeps the Drag inside the dotted container.",
  tags: ["cdk", "drag-drop"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#boundary > #box.cdk-drag" }],
});
