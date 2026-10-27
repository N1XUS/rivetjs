import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Permission Levels",
  summary: "Members with a role Select each.",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#icg-perms .item-card:nth-child(3) [data-slot=select-value]", "Editor"],
    },
  ],
});
