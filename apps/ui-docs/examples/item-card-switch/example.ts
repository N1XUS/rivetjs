import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: With Switch",
  summary: "Preference toggles: each row has its own Switch, labelled by the row title.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#ic-switch .item-card:nth-child(2) [data-slot=switch-content]",
    },
    {
      matches: "#ic-switch .item-card:nth-child(2) [data-slot=switch]:has(input:checked)",
    },
  ],
});
