import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Controlled",
  summary: "The open state lives in a two-way signal: buttons outside the sheet open it, the sheet writes back when it closes.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#sheet-controlled-open" },
    { matches: "[data-slot=sheet-dialog]" },
    { expect: ["#sheet-controlled-state", "open"] },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
    { expect: ["#sheet-controlled-state", "closed"] },
  ],
});
