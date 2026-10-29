import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Progress Feedback Durations",
  summary: "duration sets how long the progress runs after a press (0.5 s, 1.5 s, 3 s); releaseDuration sets the snap-back once it resets.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#pf-progress-500",
    },
    {
      attr: ["#pf-progress-500 .pressable-feedback__progress-feedback", "data-complete", "true"],
    },
  ],
});
