import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Disabled State",
  summary: 'NumberField demo "Disabled State".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 224, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input", "disabled", ""] }],
});
