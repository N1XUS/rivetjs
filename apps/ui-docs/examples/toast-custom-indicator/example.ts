import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Custom Indicator",
  summary: 'Toast demo "Custom Indicator".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { expect: ["[role=alertdialog]", "Custom icon indicator"] }, { matches: "[data-slot=toast-indicator] svg" }],
});
