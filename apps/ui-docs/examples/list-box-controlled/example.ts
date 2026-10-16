import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox: Controlled",
  summary: 'ListBox demo "Controlled".',
  tags: ["list-box"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[role=option]:nth-child(2)" }, { expect: ["p.text-sm", "Selected: 1, 2"] }],
});
