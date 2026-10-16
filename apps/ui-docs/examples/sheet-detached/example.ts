import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Detached",
  summary: "isDetached floats the sheet away from the viewport edge with rounded corners on every side.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { matches: "[data-sheet-detached=true]" },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
  ],
});
