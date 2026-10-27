import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Progress Feedback",
  summary: "A press starts the progress (no hold needed); onComplete fires after duration and the overlay resets after resetDelay (onReset).",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#pf-progress",
    },
    {
      expect: ["#pf-progress-status", "Sent"],
    },
    {
      expect: ["#pf-progress-status", "Idle"],
    },
  ],
});
