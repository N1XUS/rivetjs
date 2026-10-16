import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: Render Function",
  summary: 'DateField demo "Render Function".',
  tags: ["date-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-custom=date-field-group]", "data-slot", "date-input-group"] },
    { attr: ["[data-custom=date-field-input]", "data-slot", "date-input-group-input"] },
  ],
});
