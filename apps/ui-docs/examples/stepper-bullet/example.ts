import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Bullet Steps",
  summary: "Dots instead of numbers: an empty Stepper.Icon inside each indicator.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "sm",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['#stepper-bullet [data-slot="stepper-step"]:nth-child(2)', "data-status", "active"],
    },
    {
      absent: '#stepper-bullet [data-slot="stepper-check"]',
    },
  ],
});
