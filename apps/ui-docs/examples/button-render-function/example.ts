import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Render Function",
  summary: 'Button demo "Render Function".',
  tags: ["button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=button]", "data-custom", "bar"] }],
});
