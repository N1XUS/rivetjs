import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmptyState: with avatar",
  summary: "A person's avatar as the media.",
  tags: ["empty-state"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#es-avatar .empty-state__media .avatar",
    },
  ],
});
