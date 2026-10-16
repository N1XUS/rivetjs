import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select: Usage",
  summary: 'Select demo "Usage".',
  tags: ["select"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=select-trigger]" }, { click: "[role=option][data-key=texas]" }, { expect: ["[data-slot=select-value]", "Texas"] }],
});
