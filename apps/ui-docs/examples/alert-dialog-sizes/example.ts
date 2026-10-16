import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Sizes",
  summary: 'AlertDialog demo "Sizes".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button:nth-of-type(4)" },
    { matches: "[role=alertdialog].alert-dialog__dialog--lg" },
    { click: "[data-slot=alert-dialog-close-trigger]" },
    { absent: "[role=alertdialog]" },
  ],
});
