import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: Usage",
  summary: "An interactive five-star rating bound to a signal: arrow keys or a press pick a value, the count updates live.",
  tags: ["rating", "forms"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#rating-basic-value", "4"],
    },
    {
      click: "#rating-basic label:nth-of-type(2)",
    },
    {
      expect: ["#rating-basic-value", "2"],
    },
  ],
});
