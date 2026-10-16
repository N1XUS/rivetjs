import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AlertDialog: Close Methods",
  summary: 'AlertDialog demo "Close Methods".',
  tags: ["alert-dialog"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: ".max-w-2xl > div:nth-child(2) > button" },
    { matches: "[role=alertdialog]" },
    { click: "[data-slot=alert-dialog-footer] button:nth-of-type(2)" },
    { absent: "[role=alertdialog]" },
  ],
});
