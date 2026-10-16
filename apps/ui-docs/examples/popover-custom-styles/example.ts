import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover: Tailwind CSS",
  summary: 'Popover demo "Tailwind CSS".',
  tags: ["popover"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=button]" }, { expect: [".popover__heading", "Keyboard shortcuts"] }],
});
