import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Usage",
  summary: "Data + column definitions: the minimal grid with a row header column.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 358, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["tbody tr[data-key='1'] [data-column=name]", "Mara Quinn"],
    },
  ],
});
