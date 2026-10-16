import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Skeleton: User Profile",
  summary: 'Skeleton demo "User Profile".',
  tags: ["skeleton"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".skeleton" }],
});
