import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea: Full Width",
  summary: 'TextArea demo "Full Width".',
  tags: ["textarea"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "textarea.textarea--full-width" }],
});
