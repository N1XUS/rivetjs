import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Snap Points Custom Fade",
  summary: "fadeFromIndex={1}: the backdrop stays clear at the first point and fades in from the second.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { matches: "[data-sheet-snap-points=true]" },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
  ],
});
