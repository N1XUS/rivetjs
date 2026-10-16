import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Full Width",
  summary: 'InputGroup demo "Full Width".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: 184, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".input-group--full-width" }],
});
