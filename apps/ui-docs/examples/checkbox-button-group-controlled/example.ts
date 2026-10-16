import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxButtonGroup: Controlled",
  summary: "A two-way value signal: the group writes the selection, a button outside writes it back.",
  tags: ["checkbox-button-group"],
  status: "experimental",
  frame: { height: 404, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=checkbox-button-group-item]:has(input[value=hourly])" },
    { expect: ["#value", "hourly"] },
    { click: "button:not([role])" },
    { expect: ["#value", "weekly"] },
  ],
});
