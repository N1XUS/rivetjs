import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: Title Only",
  summary: "Without a description the title centres against the icon and action.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      absent: "#ic-title-only [data-slot=item-card-description]",
    },
  ],
});
