import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: Vertical Stack",
  summary: "Content laid out in a column (icon above text) for tiles in a grid.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#ic-vertical", "120 GB"],
    },
  ],
});
