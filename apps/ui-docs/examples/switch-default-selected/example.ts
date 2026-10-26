import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Default Selected",
  summary: 'Switch demo "Default Selected".',
  tags: ["switch"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=switch]:is([data-selected=true], :has(input:checked))" }],
});
