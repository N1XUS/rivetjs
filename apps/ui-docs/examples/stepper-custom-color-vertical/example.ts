import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Custom Color Vertical",
  summary: "The --stepper-active-color / --stepper-complete-color variables recolour a vertical stepper (here the warning colour).",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#stepper-custom-color-vertical", "data-orientation", "vertical"],
    },
    {
      attr: ['#stepper-custom-color-vertical [data-slot="stepper-step"]:nth-child(2)', "data-status", "complete"],
    },
  ],
});
