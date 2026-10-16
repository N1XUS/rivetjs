import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: Theme Switcher",
  summary: "Icon-only items with aria-labels switch a light / dark / system preference held in a signal.",
  tags: ["segment"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[aria-label=Dark]" }, { expect: ["#theme", "dark"] }],
});
