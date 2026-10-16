import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Skeleton: Text Content",
  summary: 'Skeleton demo "Text Content".',
  tags: ["skeleton"],
  status: "experimental",
  frame: { height: 184 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".skeleton" }],
});
