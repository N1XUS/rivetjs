import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Snap Points Sequential",
  summary: "snapToSequentialPoint: a flick moves one point at a time instead of skipping to the far end.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { click: "[data-slot=sheet-handle]" },
    { matches: "[data-slot=sheet-dialog]" },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
  ],
});
