import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: With Icons",
  summary: "A lucide icon in each indicator via Stepper.Icon.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "sm",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: '#stepper-icons [data-slot="stepper-step"]:nth-child(1) [data-slot="stepper-icon"] svg',
    },
    {
      attr: ['#stepper-icons [data-slot="stepper-step"]:nth-child(3)', "data-status", "active"],
    },
  ],
});
