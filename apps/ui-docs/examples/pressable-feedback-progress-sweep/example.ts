import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Progress Feedback Sweep",
  summary: "sweep on ProgressFeedback picks the edge the progress moves toward: right (default), left, down or up.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#pf-progress-sweep-up .pressable-feedback__progress-feedback", "data-sweep", "up"],
    },
    {
      click: "#pf-progress-sweep-up",
    },
    {
      attr: ["#pf-progress-sweep-up .pressable-feedback__progress-feedback", "data-complete", "true"],
    },
  ],
});
