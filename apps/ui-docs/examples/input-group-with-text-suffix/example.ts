import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Text Suffix",
  summary: 'InputGroup demo "Text Suffix".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=input-group-suffix]" }],
});
