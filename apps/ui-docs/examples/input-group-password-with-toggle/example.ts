import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Password Toggle",
  summary: 'InputGroup demo "Password Toggle".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input", "type", "password"] }, { click: "button[aria-label='Show password']" }, { attr: ["input", "type", "text"] }],
});
