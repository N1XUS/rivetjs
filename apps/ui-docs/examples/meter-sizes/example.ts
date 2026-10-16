import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Meter: Sizes",
  summary: 'Meter demo "Sizes".',
  tags: ["meter"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="meter"]' }],
});
