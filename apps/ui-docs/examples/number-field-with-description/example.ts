import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: With Description",
  summary: 'NumberField demo "With Description".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 224, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=description]" }],
});
