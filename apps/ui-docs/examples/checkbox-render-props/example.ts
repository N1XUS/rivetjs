import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Render Props",
  summary: 'Checkbox demo "Render Props".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=checkbox-content]", "Accept terms"] },
    { click: "[data-slot=checkbox-content]" },
    { expect: ["[data-slot=checkbox-content]", "Terms accepted"] },
  ],
});
