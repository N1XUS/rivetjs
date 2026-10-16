import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select: Controlled",
  summary: 'Select demo "Controlled".',
  tags: ["select"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["p", "Selected: California"] },
    { click: "[data-slot=select-trigger]" },
    { click: "[role=option][data-key=texas]" },
    { expect: ["p", "Selected: Texas"] },
  ],
});
