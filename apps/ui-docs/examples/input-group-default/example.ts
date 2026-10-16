import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InputGroup: Usage",
  summary: 'InputGroup demo "Usage".',
  tags: ["input-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["input", "Email address"] }, { click: "[data-slot=input-group-prefix]" }, { focused: "input" }],
});
