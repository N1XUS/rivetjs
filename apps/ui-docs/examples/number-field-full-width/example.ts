import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Full Width",
  summary: 'NumberField demo "Full Width".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".number-field--full-width" }],
});
