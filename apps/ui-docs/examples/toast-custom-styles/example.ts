import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Custom Styles",
  summary: 'Toast demo "Custom Styles".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { expect: ["[role=alertdialog]", "Draft synced"] }, { matches: "[role=alertdialog].rounded-xl" }],
});
