import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Nested",
  summary: "A sheet opened from a sheet: the parent steps back while the child is open.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { click: "#sheet-nested-child" },
    { matches: "[data-sheet-nested-open=true]" },
    { expect: ["[data-slot=sheet-dialog]:not([data-sheet-nested-open]) [data-slot=sheet-heading]", "Delivery address"] },
    { key: "Escape" },
    { absent: "[data-sheet-nested-open]" },
  ],
});
