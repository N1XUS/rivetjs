import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Render Function",
  summary: 'RadioGroup demo "Render Function".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-custom=foo][data-slot=radio-group]" }],
});
