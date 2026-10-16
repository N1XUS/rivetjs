import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: custom root element",
  summary: "Port of the Angular CDK root element example: the Drag inside a modal moves the whole modal (rootElementSelector), on the cdk div overlay layer.",
  tags: ["cdk", "drag-drop", "modal"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { absent: "#dialog" },
    { click: "#open" },
    { matches: ".rv-ModalOverlay .example-dialog #dialog #dialog-content.cdk-drag" },
    { key: "Escape" },
    { absent: "#dialog" },
  ],
});
