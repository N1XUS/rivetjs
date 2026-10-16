import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Tailwind CSS",
  summary: 'AlertDialog demo "Tailwind CSS".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { matches: "[role=alertdialog]" }, { click: "[data-slot=alert-dialog-footer] button" }, { absent: "[role=alertdialog]" }],
});
