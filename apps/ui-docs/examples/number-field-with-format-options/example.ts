import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Format Options",
  summary: 'NumberField demo "Format Options".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 640 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=number-field]" }],
});
