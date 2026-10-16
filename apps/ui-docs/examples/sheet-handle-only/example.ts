import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Handle Only",
  summary: "isHandleOnly: only the handle starts a drag, so the body can hold sliders and other draggable controls.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { matches: "[data-slot=sheet-body] [data-slot=slider]" },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
  ],
});
