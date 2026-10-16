import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Custom Portal",
  summary: 'Modal demo "Custom Portal".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { matches: "#modal-portal-container [role=dialog]" }, { click: "[data-slot=modal-footer] button" }, { absent: "[role=dialog]" }],
});
