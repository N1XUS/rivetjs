import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: List",
  summary: "The default list layout with trailing switches.",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#icg-list .item-card:first-child [data-slot=switch-content]",
    },
    {
      matches: "#icg-list .item-card:first-child [data-slot=switch]:has(input:checked)",
    },
  ],
});
