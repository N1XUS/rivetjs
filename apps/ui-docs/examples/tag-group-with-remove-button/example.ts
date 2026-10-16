import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup: With Remove Button",
  summary: 'TagGroup demo "With Remove Button".',
  tags: ["tag-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=tag-remove-button]" }, { absent: "[data-key=news]" }],
});
