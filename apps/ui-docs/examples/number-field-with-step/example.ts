import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Step Values",
  summary: 'NumberField demo "Step Values".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=number-field]" }],
});
