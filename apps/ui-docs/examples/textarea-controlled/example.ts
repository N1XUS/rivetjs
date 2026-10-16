import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea: Controlled",
  summary: 'TextArea demo "Controlled".',
  tags: ["textarea"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ fill: ["textarea", "Hello"] }, { expect: ["[data-slot=description]", "Characters: 5 / 280"] }],
});
