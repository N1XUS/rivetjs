import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Grid",
  summary: 'layout="grid" spaces the cards in two columns (one on phones); each card keeps its own surface.',
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#icg-grid[data-layout=grid]",
    },
  ],
});
