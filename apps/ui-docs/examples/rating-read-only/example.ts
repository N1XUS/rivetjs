import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: Read only",
  summary: "Read-only ratings show fractional averages (4.6, 3.2) with partially filled stars, in three sizes, next to their value.",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#rating-ro-md [data-slot=rating-value]", "4.6"],
    },
  ],
});
