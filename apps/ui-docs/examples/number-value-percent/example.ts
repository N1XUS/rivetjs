import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberValue: Percent",
  summary: "Percent style multiplies by 100; fraction digits control the precision.",
  tags: ["number-value"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#nv-percent", "3.42%"],
    },
  ],
});
