import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Skeleton: Usage",
  summary: 'Skeleton demo "Usage".',
  tags: ["skeleton"],
  status: "experimental",
  frame: { height: 296 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".skeleton" }],
});
