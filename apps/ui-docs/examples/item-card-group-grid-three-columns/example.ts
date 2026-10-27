import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Grid Three Columns",
  summary: "columns={3} sets the grid column count.",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#icg-grid-3", "style", "--item-card-group-columns:3"],
    },
  ],
});
