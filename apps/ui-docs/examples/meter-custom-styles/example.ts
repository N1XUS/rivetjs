import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Meter: Tailwind CSS",
  summary: 'Meter demo "Tailwind CSS".',
  tags: ["meter"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="meter"]' }],
});
