import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Custom Toast",
  summary: 'Toast demo "Custom Toast".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { expect: ["[role=alertdialog]", "Custom layout toast"] }, { matches: "[role=alertdialog].rounded-xl [data-slot=toast-close]" }],
});
