import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: an icon per value",
  summary: "`icon` as a function picks the icon of each value: a mood scale.",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#rt-mood .rating__item:nth-child(5) svg",
    },
  ],
});
