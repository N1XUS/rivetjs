import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup: Selection Mode",
  summary: 'ToggleButtonGroup demo "Selection Mode".',
  tags: ["toggle-button-group"],
  status: "experimental",
  frame: { height: 216 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=toggle-button-group] [aria-checked=true]", "aria-checked", "true"] }],
});
