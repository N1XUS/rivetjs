import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Hold Confirm Sweep",
  summary: "sweep picks the edge the reveal moves toward: right (default), left, down or up. Works the same on ProgressFeedback.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [],
});
