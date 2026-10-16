import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Custom Icon",
  summary: 'AlertDialog demo "Custom Icon".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { matches: "[role=alertdialog]" }, { click: "[data-slot=alert-dialog-close-trigger]" }, { absent: "[role=alertdialog]" }],
});
