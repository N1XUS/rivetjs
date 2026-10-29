import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Dynamic Icon",
  summary: "A Step render function picks the indicator icon from the step status: check, spinner or the step's own icon.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "sm",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: '#stepper-dynamic-icon [data-slot="stepper-step"]:nth-child(1) [data-icon="complete"]',
    },
    {
      matches: '#stepper-dynamic-icon [data-slot="stepper-step"]:nth-child(2) [data-icon="active"]',
    },
    {
      matches: '#stepper-dynamic-icon [data-slot="stepper-step"]:nth-child(3) [data-icon="inactive"]',
    },
    {
      click: "#stepper-dynamic-icon-next",
    },
    {
      matches: '#stepper-dynamic-icon [data-slot="stepper-step"]:nth-child(2) [data-icon="complete"]',
    },
    {
      matches: '#stepper-dynamic-icon [data-slot="stepper-step"]:nth-child(3) [data-icon="active"]',
    },
    {
      absent: '#stepper-dynamic-icon [data-icon="inactive"]',
    },
  ],
});
