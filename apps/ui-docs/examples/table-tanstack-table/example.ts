import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: TanStack Table",
  summary: 'Table demo "TanStack Table".',
  tags: ["table", "not-yet-ported"],
  status: "experimental",
  frame: { height: 320, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["tbody tr:nth-child(1)", "Kate Moore"] },
    { click: "thead th:nth-child(1)" },
    { expect: ["tbody tr:nth-child(1)", "Davis Wilson"] },
  ],
});
