import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Meter: Colors",
  summary: 'Meter demo "Colors".',
  tags: ["meter"],
  status: "experimental",
  frame: { height: 312 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="meter"]' }],
});
