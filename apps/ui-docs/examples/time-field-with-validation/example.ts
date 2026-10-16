import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: With Validation",
  summary: 'TimeField demo "With Validation".',
  tags: ["time-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["[data-type=hour]", "8"] },
    { key: "0" },
    { key: "0" },
    { key: "A" },
    { expect: ["[data-slot=field-error]", "Time must be between 9:00 AM and 5:00 PM"] },
  ],
});
