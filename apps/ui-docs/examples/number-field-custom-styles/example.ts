import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Tailwind CSS",
  summary: 'NumberField demo "Tailwind CSS".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=number-field]" }],
});
