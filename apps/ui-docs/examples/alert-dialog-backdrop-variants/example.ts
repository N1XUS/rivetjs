import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Backdrop Variants",
  summary: 'AlertDialog demo "Backdrop Variants".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button:nth-of-type(2)" },
    { matches: ".alert-dialog__backdrop--blur" },
    { click: "[data-slot=alert-dialog-close-trigger]" },
    { absent: "[role=alertdialog]" },
  ],
});
