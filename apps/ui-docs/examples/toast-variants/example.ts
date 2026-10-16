import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Variants",
  summary: 'Toast demo "Variants".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button:nth-of-type(5)" }, { expect: ["[role=alertdialog]", "Storage is full"] }, { matches: ".toast--danger" }],
});
