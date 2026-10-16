import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Scrollable Content",
  summary: "A long body scrolls inside the sheet; dragging starts from the handle and header.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { wheel: ["[data-slot=sheet-body]", 300] },
    { matches: "[data-slot=sheet-dialog]" },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
  ],
});
