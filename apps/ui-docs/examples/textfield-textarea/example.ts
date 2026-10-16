import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: TextArea",
  summary: 'TextField demo "TextArea".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: 188, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=textfield] textarea" }],
});
