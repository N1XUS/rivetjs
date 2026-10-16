import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: In Surface",
  summary: 'CheckboxGroup demo "In Surface".',
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=surface] .checkbox-group--secondary" }],
});
