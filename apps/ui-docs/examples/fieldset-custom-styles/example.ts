import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Fieldset: Tailwind CSS",
  summary: 'Fieldset demo "Tailwind CSS".',
  tags: ["fieldset"],
  status: "experimental",
  frame: { height: 600 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "fieldset.fieldset" }],
});
