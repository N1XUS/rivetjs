import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Group Horizontal",
  summary: 'Switch demo "Group Horizontal".',
  tags: ["switch"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".switch-group--horizontal" }],
});
