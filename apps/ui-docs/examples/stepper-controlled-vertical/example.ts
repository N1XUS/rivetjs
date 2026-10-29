import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Controlled Vertical",
  summary: "A vertical stepper driven by a two-way Signal: Back / Next buttons and the step buttons move the current step.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#stepper-controlled-vertical-state", "Step 2 of 4"],
    },
    {
      click: "#stepper-controlled-vertical-next",
    },
    {
      expect: ["#stepper-controlled-vertical-state", "Step 3 of 4"],
    },
    {
      attr: ['#stepper-controlled-vertical [data-slot="stepper-step"]:nth-child(3)', "data-status", "active"],
    },
    {
      click: '#stepper-controlled-vertical [data-slot="stepper-step"]:nth-child(1) button',
    },
    {
      expect: ["#stepper-controlled-vertical-state", "Step 1 of 4"],
    },
    {
      click: "#stepper-controlled-vertical-back",
    },
    {
      expect: ["#stepper-controlled-vertical-state", "Step 1 of 4"],
    },
  ],
});
