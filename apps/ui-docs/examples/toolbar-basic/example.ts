import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toolbar: Usage",
  summary: 'Toolbar demo "Usage".',
  tags: ["toolbar"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[aria-label=Bold]" }, { matches: "[aria-label=Bold][aria-pressed=true]" }],
});
