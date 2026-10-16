import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Variants",
  summary: 'NumberField demo "Variants".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".number-field--secondary" }],
});
