import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Multiple Sections",
  summary: "Several groups with headers make a settings page.",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#icg-sections", "Appearance"],
    },
  ],
});
