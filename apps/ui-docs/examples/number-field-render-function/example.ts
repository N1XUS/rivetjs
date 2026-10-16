import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Render Function",
  summary: 'NumberField demo "Render Function".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-custom=foo][data-slot=number-field]" }],
});
