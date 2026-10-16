import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Placements",
  summary: "Bottom (default), top, left and right sheets; drag towards the edge to dismiss.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button:nth-of-type(2)" },
    { matches: "[data-slot=sheet-content][data-placement=right]" },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
  ],
});
