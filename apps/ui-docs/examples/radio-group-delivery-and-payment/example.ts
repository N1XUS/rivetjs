import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Delivery & Payment",
  summary: 'RadioGroup demo "Delivery & Payment".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 640 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=radio-content] svg" }],
});
