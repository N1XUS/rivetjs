import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Meter: Custom Value Scale",
  summary: 'Meter demo "Custom Value Scale".',
  tags: ["meter"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=meter-output]", "$750.00"] }],
});
