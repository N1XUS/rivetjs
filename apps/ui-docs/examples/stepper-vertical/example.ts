import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Vertical",
  summary: 'orientation="vertical": steps stacked with the separator between the indicators.',
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#stepper-vertical", "data-orientation", "vertical"],
    },
    {
      attr: ['#stepper-vertical [data-slot="stepper-step"]:nth-child(3)', "data-status", "active"],
    },
  ],
});
