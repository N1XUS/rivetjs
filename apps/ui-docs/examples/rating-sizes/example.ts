import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: sizes",
  summary: "Small, medium and large stars.",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#rt-sizes .rating--lg",
    },
  ],
});
