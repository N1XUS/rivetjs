import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: Multiple Expanded",
  summary: 'Accordion demo "Multiple Expanded".',
  tags: ["accordion"],
  status: "experimental",
  frame: { height: 256, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=accordion-item]:nth-of-type(1) [data-slot=accordion-trigger]" },
    { click: "[data-slot=accordion-item]:nth-of-type(2) [data-slot=accordion-trigger]" },
    { matches: "[data-slot=accordion-item]:nth-of-type(1):is([open], :has([data-slot=accordion-trigger][aria-expanded=true]))" },
    { matches: "[data-slot=accordion-item]:nth-of-type(2):is([open], :has([data-slot=accordion-trigger][aria-expanded=true]))" },
  ],
});
