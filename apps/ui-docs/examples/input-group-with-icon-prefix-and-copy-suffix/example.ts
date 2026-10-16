import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Icon Prefix and Copy Button",
  summary: 'InputGroup demo "Icon Prefix and Copy Button".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=input-group-suffix] button[aria-label=Copy]" }],
});
