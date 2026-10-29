import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Vertical With Icons",
  summary: "A vertical stepper with lucide icons in the indicators; a two-way Signal makes every step a button.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: '#stepper-vertical-with-icons [data-slot="stepper-step"]:nth-child(4) [data-slot="stepper-icon"] svg',
    },
    {
      attr: ['#stepper-vertical-with-icons [data-slot="stepper-step"]:nth-child(2)', "data-status", "active"],
    },
    {
      click: '#stepper-vertical-with-icons [data-slot="stepper-step"]:nth-child(4) button',
    },
    {
      attr: ['#stepper-vertical-with-icons [data-slot="stepper-step"]:nth-child(4)', "data-status", "active"],
    },
  ],
});
