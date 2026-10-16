import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: Controlled",
  summary: 'TimeField demo "Controlled".',
  tags: ["time-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "text=Set now" }, { expect: ["[data-slot=description]", ":"] }, { click: "text=Clear" }, { expect: ["[data-slot=description]", "(empty)"] }],
});
