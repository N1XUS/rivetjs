import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Snap Points",
  summary: "The sheet rests at 40 % or full height; drag or press the handle to move between the points.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { click: "[data-slot=sheet-handle]" },
    { expect: ["#sheet-snap-point", "1"] },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
  ],
});
