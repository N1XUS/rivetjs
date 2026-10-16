import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Controlled",
  summary: 'NumberField demo "Controlled".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button[data-slot=button]:last-of-type" }, { expect: ["[data-slot=description]", "2048"] }],
});
