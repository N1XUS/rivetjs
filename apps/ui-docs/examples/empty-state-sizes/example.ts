import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmptyState: sizes",
  summary: "Small, medium and large spacing.",
  tags: ["empty-state"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#es-sizes .empty-state--sm",
    },
  ],
});
