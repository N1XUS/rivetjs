import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: product review",
  summary: "An average score with the share of each star count.",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#rt-review [role=img]",
    },
  ],
});
