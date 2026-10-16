import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Skeleton: Tailwind CSS",
  summary: 'Skeleton demo "Tailwind CSS".',
  tags: ["skeleton"],
  status: "experimental",
  frame: { height: 298 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".skeleton" }],
});
