import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Custom Icons",
  summary: 'NumberField demo "Custom Icons".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=number-field-increment-button] svg" }],
});
