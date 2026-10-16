import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover: Render Function",
  summary: 'Popover demo "Render Function".',
  tags: ["popover"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=button]" }, { attr: [".popover", "data-custom", "foo"] }],
});
