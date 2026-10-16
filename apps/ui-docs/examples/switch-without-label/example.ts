import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Without Label",
  summary: 'Switch demo "Without Label".',
  tags: ["switch"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input[role=switch]", "aria-label", "Enable notifications"] }],
});
