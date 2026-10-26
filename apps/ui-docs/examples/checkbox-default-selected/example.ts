import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Default Selected",
  summary: 'Checkbox demo "Default Selected".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=checkbox]:is([data-selected=true], :has(input:checked))" }],
});
