import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberValue: Usage",
  summary: "A number formatted for the reader's locale: grouping, decimals and currency come from Intl.NumberFormat.",
  tags: ["number-value"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#nv-basic [data-slot=number-value-value]", "$1,284,903.50"],
    },
  ],
});
