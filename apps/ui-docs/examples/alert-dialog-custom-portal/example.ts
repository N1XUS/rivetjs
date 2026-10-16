import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Custom Portal",
  summary: 'AlertDialog demo "Custom Portal".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "#alert-dialog-portal-container [role=alertdialog]" },
    { click: "[data-slot=alert-dialog-footer] button" },
    { absent: "[role=alertdialog]" },
  ],
});
