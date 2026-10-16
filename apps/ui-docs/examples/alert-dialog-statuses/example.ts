import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Statuses",
  summary: 'AlertDialog demo "Statuses".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button:nth-of-type(2)" },
    { matches: "[data-slot=alert-dialog-icon].alert-dialog__icon--success" },
    { click: "[data-slot=alert-dialog-close-trigger]" },
    { absent: "[role=alertdialog]" },
  ],
});
