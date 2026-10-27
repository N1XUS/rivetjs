import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: with label",
  summary: "A visible label names the group.",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "[aria-labelledby=rt-label][role=radiogroup]",
    },
  ],
});
