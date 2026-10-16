import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressBar: Custom Value Scale",
  summary: 'ProgressBar demo "Custom Value Scale".',
  tags: ["progress-bar"],
  status: "experimental",
  frame: { height: 441 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=progress-bar-output]", "75%"] },
    { fill: ["[data-slot=number-field]:nth-of-type(3) input", "500"] },
    { click: "[data-slot=number-field]:nth-of-type(1) input" },
    { expect: ["[data-slot=progress-bar-output]", "100%"] },
  ],
});
