import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: Pressable",
  summary: "Render the card as a link (or button) with render: it gets hover and pressed tints and a focus ring.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#ic-pressable a.item-card[href='#security']",
    },
    {
      press: ["#ic-pressable a[href='#profile']", "Tab"],
    },
    {
      focused: "#ic-pressable a[href='#security']",
    },
  ],
});
