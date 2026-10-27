import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: With Header",
  summary: "A header with title and description labels the group (aria-labelledby on the title id).",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      name: ["#icg-header", "Backups"],
    },
  ],
});
