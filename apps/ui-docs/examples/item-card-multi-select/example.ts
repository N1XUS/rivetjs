import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: With Multi Select",
  summary: "A trailing multi-select: pick several channels for one kind of alert.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#ic-multi [data-slot=select-value]", "Email"],
    },
  ],
});
