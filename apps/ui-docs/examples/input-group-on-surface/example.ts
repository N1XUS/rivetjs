import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: In Surface",
  summary: 'InputGroup demo "In Surface".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=surface] [data-slot=input-group]" }],
});
