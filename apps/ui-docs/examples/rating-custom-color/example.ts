import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: custom color",
  summary: "Set `--rating-color` and `--rating-empty` with your own classes.",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#rt-colors .rating",
    },
  ],
});
