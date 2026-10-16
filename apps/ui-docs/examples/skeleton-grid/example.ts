import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Skeleton: Grid",
  summary: 'Skeleton demo "Grid".',
  tags: ["skeleton"],
  status: "experimental",
  frame: { height: 152 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".skeleton" }],
});
