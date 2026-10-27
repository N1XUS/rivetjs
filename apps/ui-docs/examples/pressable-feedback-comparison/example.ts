import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Comparison",
  summary: "Each layer on its own: highlight, ripple, hold to confirm, progress.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [],
});
