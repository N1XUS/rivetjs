import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: heart icon",
  summary: "Any lucide icon in place of the star.",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#rt-heart .rating__item svg",
    },
  ],
});
