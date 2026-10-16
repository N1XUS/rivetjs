import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Required Field",
  summary: 'NumberField demo "Required Field".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 204, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input", "required", ""] }],
});
