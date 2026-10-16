import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Controlled State",
  summary: 'AlertDialog demo "Controlled State".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["span.font-mono", "closed"] },
    { click: "button" },
    { matches: "[role=alertdialog]" },
    { expect: ["span.font-mono", "open"] },
    { click: "[data-slot=alert-dialog-close-trigger]" },
    { absent: "[role=alertdialog]" },
    { expect: ["span.font-mono", "closed"] },
  ],
});
