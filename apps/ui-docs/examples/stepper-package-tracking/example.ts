import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Package Tracking",
  summary: "A display-only shipment tracker: icon indicators, timestamps as descriptions and a half-filled separator after the current step.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "sm",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['#stepper-package-tracking [data-slot="stepper-step"]:nth-child(3)', "data-status", "active"],
    },
    {
      absent: "#stepper-package-tracking button",
    },
    {
      matches: '#stepper-package-tracking [data-slot="stepper-step"]:nth-child(3) [data-slot="stepper-separator-fill"][style*="0.5"]',
    },
  ],
});
