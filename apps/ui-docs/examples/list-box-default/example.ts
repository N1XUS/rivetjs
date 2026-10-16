import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox: Usage",
  summary: 'ListBox demo "Usage".',
  tags: ["list-box"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[role=option]" }, { matches: "[role=option][aria-selected=true]" }],
});
