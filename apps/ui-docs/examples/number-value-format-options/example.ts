import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberValue: Format Options",
  summary:
    "Any Intl.NumberFormat option through formatOptions (merged over the convenience props): significant digits, accounting negatives, scientific notation.",
  tags: ["number-value"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#nv-options", "($1,830.00)"],
    },
  ],
});
