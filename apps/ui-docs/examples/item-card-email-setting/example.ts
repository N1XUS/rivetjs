import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: Email Setting",
  summary: "A settings row: what the setting does, and a Select for how often.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#ic-email [data-slot=select-value]", "Weekly"],
    },
  ],
});
