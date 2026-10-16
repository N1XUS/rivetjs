import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Custom Trigger",
  summary: 'Modal demo "Custom Trigger".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=modal-trigger]" }, { matches: "[role=dialog]" }, { key: "Escape" }, { absent: "[role=dialog]" }],
});
