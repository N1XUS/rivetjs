import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Variants",
  summary: "The group surface in its five variants.",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 640 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#icg-v-tertiary.item-card-group--tertiary",
    },
  ],
});
