import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Emoji Picker Sheet",
  summary: "A reaction picker: pressing a reaction closes the sheet and shows the pick.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { click: "[data-slot=sheet-body] button:nth-child(2)" },
    { absent: "[data-slot=sheet-dialog]" },
    { expect: ["#sheet-emoji-picked", "Love"] },
  ],
});
