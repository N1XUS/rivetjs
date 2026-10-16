import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Variants",
  summary: 'RadioGroup demo "Variants".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 360, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".radio-group--secondary" }],
});
