import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: render function",
  summary: "`renderItem` draws each value from `isActive` / `partialPercent`: numbered pills.",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 180 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#rt-render .rating__item:nth-child(7) .bg-accent",
    },
  ],
});
