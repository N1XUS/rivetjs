import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Dismiss Behavior",
  summary: 'AlertDialog demo "Dismiss Behavior".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: ".max-w-sm > div:nth-child(2) > button" },
    { matches: "[role=alertdialog]" },
    { key: "Escape" },
    { matches: "[role=alertdialog]" },
    { click: "[data-slot=alert-dialog-close-trigger]" },
    { absent: "[role=alertdialog]" },
  ],
});
