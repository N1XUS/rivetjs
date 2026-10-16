import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Custom color",
  summary: "Override --stepper-active-color / --stepper-complete-color (here: the success token).",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "sm",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['#stepper-custom-color [data-slot="stepper-step"]:nth-child(1)', "data-status", "complete"],
    },
  ],
});
