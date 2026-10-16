import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Custom Queue",
  summary: 'Toast demo "Custom Queue".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button:nth-of-type(1)" }, { expect: ["[role=alertdialog]", "New notification"] }],
});
