import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ErrorMessage: Usage",
  summary: 'ErrorMessage demo "Usage".',
  tags: ["error-message"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=error-message]", "Please select at least one category"] },
    { click: "[data-key=news]" },
    { absent: "[data-slot=error-message]:not(:empty)" },
  ],
});
