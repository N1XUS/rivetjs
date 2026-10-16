import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Usage",
  summary: 'AlertDialog demo "Usage".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=alertdialog][data-slot=alert-dialog-dialog]" },
    { expect: ["[data-slot=alert-dialog-heading]", "Delete project permanently?"] },
    { key: "Escape" },
    { matches: "[role=alertdialog]" },
    { click: "[data-slot=alert-dialog-footer] button" },
    { absent: "[role=alertdialog]" },
  ],
});
