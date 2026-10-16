import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: With Validation",
  summary: 'DateField demo "With Validation".',
  tags: ["date-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["[data-type=month]", "0"] },
    { key: "1" },
    { key: "0" },
    { key: "1" },
    { key: "2" },
    { key: "0" },
    { key: "2" },
    { key: "0" },
    { expect: ["[data-slot=field-error]", "Date must be today or in the future"] },
  ],
});
