import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: free drag position",
  summary: "Port of the Angular CDK free drag position example: freeDragPosition sets the position of a free Drag; the button moves it by 50 px.",
  tags: ["cdk", "drag-drop"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#change" },
    { matches: "#box[style*='translate3d(50px, 50px, 0px)']" },
    { click: "#change" },
    { matches: "#box[style*='translate3d(100px, 100px, 0px)']" },
  ],
});
