import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Display only",
  summary: "Without onStepChange (or a Signal) the steps are not buttons: a read-only progress indicator.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "sm",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      absent: "#stepper-display-only button",
    },
    {
      attr: ['#stepper-display-only [data-slot="stepper-step"]:nth-child(3)', "aria-current", "step"],
    },
  ],
});
