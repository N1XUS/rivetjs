import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: Input Container",
  summary: 'DateRangePicker demo "Input Container": long second-precision values stay on one scrolling line in `DateField.InputContainer`.',
  tags: ["date-range-picker"],
  status: "experimental",
  frame: { height: 200, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=date-input-group-input-container]" },
    { click: "[data-slot=date-range-picker-trigger]" },
    { matches: "[data-slot=range-calendar]" },
  ],
});
