import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Non Dismissable",
  summary: "isDismissable={false}: no drag to close, no Escape, no backdrop press; only the explicit buttons close it.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { key: "Escape" },
    { matches: "[data-slot=sheet-dialog]" },
    { click: "#sheet-terms-accept" },
    { absent: "[data-slot=sheet-dialog]" },
  ],
});
