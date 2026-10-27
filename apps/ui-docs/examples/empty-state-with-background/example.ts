import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmptyState: with background",
  summary: "A soft gradient behind the state, set with your own classes.",
  tags: ["empty-state"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#es-bg .empty-state__content button",
    },
  ],
});
