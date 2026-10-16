import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: Custom Value",
  summary: "format(value) changes the displayed text; a function child renders the display itself.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=number-stepper-increment-button]" },
    { expect: ["[data-slot=number-stepper-display]", "4 nights"] },
    { click: "[data-slot=number-stepper]:nth-of-type(2) [data-slot=number-stepper-increment-button]" },
    { matches: "[data-slot=number-stepper]:nth-of-type(2) svg.fill-warning:nth-of-type(5)" },
  ],
});
