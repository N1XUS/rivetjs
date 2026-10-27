import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmptyState: minimal",
  summary: "Title and description only.",
  tags: ["empty-state"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#es-minimal .empty-state__title",
    },
  ],
});
