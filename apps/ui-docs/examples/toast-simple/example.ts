import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Simple Toasts",
  summary: 'Toast demo "Simple Toasts".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button:nth-of-type(2)" }, { expect: ["[role=alertdialog]", "Operation completed"] }, { matches: ".toast--success" }],
});
