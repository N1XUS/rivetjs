import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmptyState: outline",
  summary: "A dashed border marks the area that will fill up.",
  tags: ["empty-state"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#es-outline.empty-state--outline",
    },
  ],
});
