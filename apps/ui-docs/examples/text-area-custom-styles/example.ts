import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea: Tailwind CSS",
  summary: 'TextArea demo "Tailwind CSS".',
  tags: ["textarea"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "textarea.textarea" }],
});
