import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberValue: Tabular Nums",
  summary: "isTabular uses tabular numerals: every digit has the same width, so a column of values lines up and a changing value does not jitter.",
  tags: ["number-value"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#nv-tabular .number-value--tabular",
    },
  ],
});
