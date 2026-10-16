import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Render function",
  summary: "A function child of Stepper.Step receives the step state (index, status, isLast) to render custom content.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "sm",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ['#stepper-render-function [data-slot="stepper-step"]:nth-child(1) [data-slot="stepper-description"]', "Done"],
    },
    {
      expect: ['#stepper-render-function [data-slot="stepper-step"]:nth-child(2) [data-slot="stepper-description"]', "In progress"],
    },
    {
      expect: ['#stepper-render-function [data-slot="stepper-step"]:nth-child(3) [data-slot="stepper-description"]', "Up next"],
    },
  ],
});
