import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Usage",
  summary: 'RadioGroup demo "Usage".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-slot=radio]:nth-of-type(2)", "data-selected", "true"] },
    { click: "[data-slot=radio]:nth-of-type(3) [data-slot=radio-content]" },
    { attr: ["[data-slot=radio]:nth-of-type(3)", "data-selected", "true"] },
  ],
});
