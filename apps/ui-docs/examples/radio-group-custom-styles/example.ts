import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Tailwind CSS",
  summary: 'RadioGroup demo "Tailwind CSS".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=radio-content].rounded-xl" }],
});
