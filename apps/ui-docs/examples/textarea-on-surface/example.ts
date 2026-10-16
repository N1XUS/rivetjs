import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea: In Surface",
  summary: 'TextArea demo "In Surface".',
  tags: ["textarea"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=surface] textarea.textarea--secondary" }],
});
