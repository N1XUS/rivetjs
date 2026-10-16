import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: Render Function",
  summary: 'CheckboxGroup demo "Render Function".',
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-custom=foo][data-slot=checkbox-group]" }],
});
