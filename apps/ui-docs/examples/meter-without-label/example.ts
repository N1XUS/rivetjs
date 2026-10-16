import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Meter: Without Label",
  summary: 'Meter demo "Without Label".',
  tags: ["meter"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="meter"]' }],
});
