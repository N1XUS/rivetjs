import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Custom Trigger",
  summary: 'AlertDialog demo "Custom Trigger".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=alert-dialog-trigger]" },
    { matches: "[role=alertdialog]" },
    { click: "[data-slot=alert-dialog-close-trigger]" },
    { absent: "[role=alertdialog]" },
  ],
});
