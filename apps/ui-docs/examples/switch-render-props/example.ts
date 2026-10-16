import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Render Props",
  summary: 'Switch demo "Render Props".',
  tags: ["switch"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=switch-content]", "Disabled"] },
    { click: "[data-slot=switch-content]" },
    { expect: ["[data-slot=switch-content]", "Enabled"] },
  ],
});
