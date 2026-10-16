import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Controlled",
  summary: 'SearchField demo "Controlled".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button:nth-of-type(2)" }, { expect: ["[data-slot=description]", "example query"] }],
});
