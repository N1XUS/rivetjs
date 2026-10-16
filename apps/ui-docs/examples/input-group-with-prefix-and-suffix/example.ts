import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: With Prefix and Suffix",
  summary: 'InputGroup demo "With Prefix and Suffix".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=input-group-prefix]" }, { matches: "[data-slot=input-group-suffix]" }],
});
