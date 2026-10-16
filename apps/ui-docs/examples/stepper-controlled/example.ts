import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Controlled",
  summary: "currentStep is a two-way signal: the stepper and the buttons below share it.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "sm",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#stepper-controlled-state", "Step 2 of 4"],
    },
    {
      click: "#stepper-controlled-next",
    },
    {
      expect: ["#stepper-controlled-state", "Step 3 of 4"],
    },
    {
      attr: ['#stepper-controlled [data-slot="stepper-step"]:nth-child(3)', "data-status", "active"],
    },
    {
      click: '#stepper-controlled [data-slot="stepper-step"]:nth-child(1) button',
    },
    {
      expect: ["#stepper-controlled-state", "Step 1 of 4"],
    },
  ],
});
