import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Pressable",
  summary: "Link rows in a list group: hover and focus tint the row inside the shared surface.",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#icg-pressable a.item-card[href='#privacy']",
    },
  ],
});
