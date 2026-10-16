import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Variants",
  summary: 'InputGroup demo "Variants".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".input-group--secondary" }],
});
