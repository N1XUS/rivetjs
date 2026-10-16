import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CloseButton: Interactive",
  summary: 'CloseButton demo "Interactive".',
  tags: ["close-button"],
  status: "experimental",
  frame: { height: 116 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["span.text-sm", "Clicked: 0 times"] },
    { click: "[data-slot=close-button]" },
    { expect: ["span.text-sm", "Clicked: 1 times"] },
    { attr: ["[data-slot=close-button]", "aria-label", "Close (clicked 1 times)"] },
  ],
});
