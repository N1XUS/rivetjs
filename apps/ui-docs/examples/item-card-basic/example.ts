import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: Usage",
  summary: "An item card: leading icon, title and description, and a trailing action.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#ic-basic [data-slot=item-card-title]", "Push notifications"],
    },
    {
      click: "#ic-basic [data-slot=switch-content]",
    },
    {
      matches: "#ic-basic [data-slot=switch]:not(:has(input:checked))",
    },
  ],
});
