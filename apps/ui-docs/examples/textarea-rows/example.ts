import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea: Rows and Resizing",
  summary: 'TextArea demo "Rows and Resizing".',
  tags: ["textarea"],
  status: "experimental",
  frame: { height: 332, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "textarea[rows]" }],
});
