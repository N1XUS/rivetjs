import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Uncontrolled (client-side)",
  summary: "`allowsSorting` columns sort on header press; locale-aware compare, nulls last, stable.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 358, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["tbody tr[data-key] [data-column=name]", "Bo Lindqvist"],
    },
  ],
});
