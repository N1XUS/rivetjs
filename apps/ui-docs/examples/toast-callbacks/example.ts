import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Callbacks",
  summary: 'Toast demo "Callbacks".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button:nth-of-type(4)" },
    { expect: ["[role=alertdialog]", "Important notification"] },
    { hover: "[data-slot=toast]" },
    { click: "[data-slot=toast-close]" },
    { expect: [".min-h-\\[120px\\]", "Important notification (manually closed)"] },
  ],
});
