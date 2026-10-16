import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Icon Prefix and Text Suffix",
  summary: 'InputGroup demo "Icon Prefix and Text Suffix".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=input-group-prefix] svg" }],
});
