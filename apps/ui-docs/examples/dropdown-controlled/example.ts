import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dropdown: Controlled",
  summary: 'Dropdown demo "Controlled".',
  tags: ["dropdown"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["p", "Selected: bold"] },
    { click: "button[aria-label=Menu]" },
    { click: "[data-key=italic]" },
    { expect: ["p", "Selected: bold, italic"] },
  ],
});
