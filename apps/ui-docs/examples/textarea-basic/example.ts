import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea: Usage",
  summary: 'TextArea demo "Usage".',
  tags: ["textarea"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "textarea.textarea" }],
});
