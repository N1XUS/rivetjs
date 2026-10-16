import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Required Field",
  summary: 'SearchField demo "Required Field".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 204, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input", "required", ""] }],
});
