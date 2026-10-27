import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: Without Icon",
  summary: "The icon is optional: text starts at the card edge.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      absent: "#ic-no-icon [data-slot=item-card-icon]",
    },
  ],
});
