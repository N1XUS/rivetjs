import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmptyState: full height",
  summary: "The state fills its container, centred both ways.",
  tags: ["empty-state"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#es-full .empty-state__media[data-variant=icon]",
    },
  ],
});
