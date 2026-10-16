import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Keyboard Shortcut",
  summary: 'InputGroup demo "Keyboard Shortcut".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=input-group-suffix] kbd" }],
});
