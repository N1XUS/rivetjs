import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup: Controlled",
  summary: 'ToggleButtonGroup demo "Controlled".',
  tags: ["toggle-button-group"],
  status: "experimental",
  frame: { height: 132 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["p.text-sm", "Selected: bold"] }, { click: "[aria-label=Italic]" }, { expect: ["p.text-sm", "Selected: bold, italic"] }],
});
