import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: With Progress Feedback",
  summary: "Highlight and ProgressFeedback on a pay button: a press runs the progress, onComplete and onReset update the status line.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#pf-with-progress",
    },
    {
      expect: ["#pf-with-progress-status", "Payment sent"],
    },
    {
      expect: ["#pf-with-progress-status", "Ready to pay"],
    },
  ],
});
