import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Usage",
  summary: "A bottom sheet with a drag handle: drag it down, press Escape or a footer button to close.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { expect: ["[data-slot=sheet-heading]", "Share this trip"] },
    { matches: "[data-slot=sheet-handle]" },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
  ],
});
