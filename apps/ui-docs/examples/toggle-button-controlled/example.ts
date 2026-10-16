import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButton: Controlled",
  summary: 'ToggleButton demo "Controlled".',
  tags: ["toggle-button"],
  status: "experimental",
  frame: { height: 132 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["p.text-sm", "Not selected"] },
    { click: "[data-slot=toggle-button]" },
    { expect: ["[data-slot=toggle-button]", "Liked"] },
    { expect: ["p.text-sm", "Status: Selected"] },
  ],
});
