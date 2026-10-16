import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorArea: With Dots",
  summary: 'ColorArea demo "With Dots".',
  tags: ["color-area"],
  status: "experimental",
  frame: { height: 794, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=color-area].color-area--show-dots" }],
});
