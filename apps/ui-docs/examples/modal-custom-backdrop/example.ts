import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Custom Backdrop",
  summary: 'Modal demo "Custom Backdrop".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { matches: "[role=dialog]" }, { key: "Escape" }, { absent: "[role=dialog]" }],
});
