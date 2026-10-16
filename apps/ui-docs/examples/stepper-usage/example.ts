import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Usage",
  summary: "A four-step checkout; click a step or use Back / Next to move between steps.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "sm",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['#stepper-usage [data-slot="stepper-step"]:nth-child(1)', "data-status", "active"],
    },
    {
      click: "#stepper-usage-next",
    },
    {
      attr: ['#stepper-usage [data-slot="stepper-step"]:nth-child(1)', "data-status", "complete"],
    },
    {
      attr: ['#stepper-usage [data-slot="stepper-step"]:nth-child(2)', "data-status", "active"],
    },
    {
      click: '#stepper-usage [data-slot="stepper-step"]:nth-child(4) button',
    },
    {
      attr: ['#stepper-usage [data-slot="stepper-step"]:nth-child(4)', "data-status", "active"],
    },
  ],
});
