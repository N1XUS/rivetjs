import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag and drop: axis lock",
  summary: "Port of the Angular CDK axis lock example: lockAxis restricts one Drag to vertical and one to horizontal movement.",
  tags: ["cdk", "drag-drop"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#y-box.cdk-drag" }, { matches: "#x-box.cdk-drag" }],
});
