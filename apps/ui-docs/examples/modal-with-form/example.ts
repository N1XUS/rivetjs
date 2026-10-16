import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: With Form",
  summary: 'Modal demo "With Form".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { matches: "[role=dialog] input[name=email]" }, { key: "Escape" }, { absent: "[role=dialog]" }],
});
