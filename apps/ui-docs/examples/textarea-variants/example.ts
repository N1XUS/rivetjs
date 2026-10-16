import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea: Variants",
  summary: 'TextArea demo "Variants".',
  tags: ["textarea"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "textarea.textarea--secondary" }],
});
