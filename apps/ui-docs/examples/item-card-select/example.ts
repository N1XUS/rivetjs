import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: With Select",
  summary: "A trailing Select: change the language without leaving the list.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#ic-select [data-slot=select-trigger]",
    },
    {
      click: "[role=option][data-key=deutsch]",
    },
    {
      expect: ["#ic-select [data-slot=select-value]", "Deutsch"],
    },
  ],
});
