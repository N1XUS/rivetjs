import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Fieldset: In Surface",
  summary: 'Fieldset demo "In Surface".',
  tags: ["fieldset"],
  status: "experimental",
  frame: { height: 600 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=surface] fieldset" }],
});
