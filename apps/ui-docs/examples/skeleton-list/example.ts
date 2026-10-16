import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Skeleton: List Items",
  summary: 'Skeleton demo "List Items".',
  tags: ["skeleton"],
  status: "experimental",
  frame: { height: 208 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".skeleton" }],
});
