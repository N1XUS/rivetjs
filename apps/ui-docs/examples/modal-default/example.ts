import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Usage",
  summary: 'Modal demo "Usage".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=modal-dialog]" },
    { expect: ["[data-slot=modal-heading]", "Welcome to Rivet UI"] },
    { click: "[data-slot=modal-footer] button" },
    { absent: "[role=dialog]" },
  ],
});
