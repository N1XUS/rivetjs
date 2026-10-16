import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: In Surface",
  summary: 'NumberField demo "In Surface".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 272, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=surface] [data-slot=number-field]" }],
});
