import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Disabled State",
  summary: 'SearchField demo "Disabled State".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 224, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input", "disabled", ""] }],
});
