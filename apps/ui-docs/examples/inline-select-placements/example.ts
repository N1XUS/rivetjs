import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InlineSelect: Placements",
  summary: "InlineSelect.Popover placement: bottom end (default), bottom start, top.",
  tags: ["inline-select"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=inline-select]:nth-of-type(3) [data-slot=inline-select-trigger]" },
    { attr: ["[data-slot=inline-select-popover]", "data-placement", "top"] },
  ],
});
