import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Free Trial Timeline",
  summary: "A display-only vertical timeline in a card: what happens today, on the reminder day and when the trial ends.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['#stepper-free-trial-timeline [data-slot="stepper-step"]:nth-child(1)', "data-status", "active"],
    },
    {
      absent: "#stepper-free-trial-timeline button",
    },
  ],
});
