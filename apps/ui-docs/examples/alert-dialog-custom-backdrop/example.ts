import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Custom Backdrop",
  summary: 'AlertDialog demo "Custom Backdrop".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { matches: "[role=alertdialog]" }, { click: "[data-slot=alert-dialog-close-trigger]" }, { absent: "[role=alertdialog]" }],
});
