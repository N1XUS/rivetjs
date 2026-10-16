import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Skeleton: Animation Types",
  summary: 'Skeleton demo "Animation Types".',
  tags: ["skeleton"],
  status: "experimental",
  frame: { height: 448 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".skeleton" }],
});
