import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberValue: Currency",
  summary: "Currency values in different currencies and locales; the locale prop overrides the page locale.",
  tags: ["number-value"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#nv-currency", "2.499,99"],
    },
  ],
});
