import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberValue: With Prefix Suffix",
  summary:
    "Prefix and suffix text around the number, as shorthand props or as compound parts in reading order; or a render function that receives the formatted string.",
  tags: ["number-value"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#nv-affix", "$29/month"],
    },
    {
      expect: ["#nv-affix", "12% faster"],
    },
  ],
});
