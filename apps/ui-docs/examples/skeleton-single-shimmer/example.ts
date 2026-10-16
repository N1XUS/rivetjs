import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Skeleton: Single Shimmer",
  summary: 'Skeleton demo "Single Shimmer".',
  tags: ["skeleton"],
  status: "experimental",
  frame: { height: 152 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".skeleton" }],
});
