import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Custom Completed Icon",
  summary: "Stepper.Indicator children replace the default check: completed steps show a lucide icon, the others keep their number.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "xs",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: '#stepper-custom-completed-icon [data-slot="stepper-step"]:nth-child(1) [data-completed-icon]',
    },
    {
      expect: ['#stepper-custom-completed-icon [data-slot="stepper-step"]:nth-child(4) [data-slot="stepper-indicator"]', "4"],
    },
    {
      click: '#stepper-custom-completed-icon [data-slot="stepper-step"]:nth-child(4) button',
    },
    {
      matches: '#stepper-custom-completed-icon [data-slot="stepper-step"]:nth-child(3) [data-completed-icon]',
    },
    {
      absent: '#stepper-custom-completed-icon [data-slot="stepper-step"]:nth-child(4) [data-completed-icon]',
    },
  ],
});
