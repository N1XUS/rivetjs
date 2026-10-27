import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberValue: Sign Display",
  summary: "signDisplay shows the sign of changes: always, except for zero, or never.",
  tags: ["number-value"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#nv-sign", "+12.5%"],
    },
  ],
});
