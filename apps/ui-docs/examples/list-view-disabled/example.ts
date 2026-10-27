import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListView: Disabled Items",
  summary: "disabledKeys turns rows off: no selection, no focus, dimmed.",
  tags: ["list-view"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#lv-disabled [role=row][data-key=grace]", "data-disabled", "true"],
    },
  ],
});
