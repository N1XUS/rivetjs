import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Copy Button Suffix",
  summary: 'InputGroup demo "Copy Button Suffix".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=input-group-suffix] button[aria-label=Copy]" }],
});
