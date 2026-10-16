import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Promise",
  summary: 'Toast demo "Promise".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "div.space-y-3:nth-of-type(2) button" },
    { matches: "[role=alertdialog] [data-slot=spinner]" },
    { expect: ["[role=alertdialog]", "Uploading file..."] },
  ],
});
