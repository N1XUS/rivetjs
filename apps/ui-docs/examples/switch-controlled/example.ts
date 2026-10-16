import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Controlled",
  summary: 'Switch demo "Controlled".',
  tags: ["switch"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["p", "off"] }, { click: "[data-slot=switch-content]" }, { expect: ["p", "on"] }],
});
