import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Usage",
  summary: "Item cards grouped on one surface, divided by hairlines.",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#icg-basic.item-card-group--list > .item-card + .item-card",
    },
  ],
});
