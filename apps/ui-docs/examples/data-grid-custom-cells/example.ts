import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Custom Cell Rendering",
  summary: "`cell` renders any content per column: avatar + email, status chips, aligned numbers.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 454, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["tbody tr[data-key='3'] .chip", "invited"],
    },
  ],
});
