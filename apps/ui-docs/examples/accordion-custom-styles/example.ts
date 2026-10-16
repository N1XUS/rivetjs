import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: Tailwind CSS",
  summary: 'Accordion demo "Tailwind CSS".',
  tags: ["accordion"],
  status: "experimental",
  frame: { height: 276, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".accordion.rounded-2xl" },
    { click: "[data-slot=accordion-item]:nth-of-type(2) [data-slot=accordion-trigger]" },
    { matches: "[data-slot=accordion-item]:nth-of-type(2) [data-slot=accordion-trigger][aria-expanded=true]" },
    { expect: ["[data-slot=accordion-item]:nth-of-type(2) [data-slot=accordion-panel]", "browser extension"] },
  ],
});
