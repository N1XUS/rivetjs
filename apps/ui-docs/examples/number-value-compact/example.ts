import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberValue: Compact",
  summary: "Compact notation shortens large numbers (1.2K, 3.4M, 7.1B), short or long display.",
  tags: ["number-value"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#nv-compact", "3.4M"],
    },
    {
      expect: ["#nv-compact", "3.4 million"],
    },
  ],
});
