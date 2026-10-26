import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: Usage",
  summary: 'Accordion demo "Usage".',
  tags: ["accordion"],
  status: "experimental",
  frame: { height: 360, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=accordion-item]:nth-of-type(1):is(details:not([open]), :has([data-slot=accordion-trigger][aria-expanded=false]))" },
    { click: "[data-slot=accordion-item]:nth-of-type(1) [data-slot=accordion-trigger]" },
    { matches: "[data-slot=accordion-item]:nth-of-type(1):is([open], :has([data-slot=accordion-trigger][aria-expanded=true]))" },
    { expect: ["[data-slot=accordion-item]:nth-of-type(1) [data-slot=accordion-panel]", "Browse our products"] },
    { click: "[data-slot=accordion-item]:nth-of-type(2) [data-slot=accordion-trigger]" },
    { matches: "[data-slot=accordion-item]:nth-of-type(2):is([open], :has([data-slot=accordion-trigger][aria-expanded=true]))" },
    { matches: "[data-slot=accordion-item]:nth-of-type(1):is(details:not([open]), :has([data-slot=accordion-trigger][aria-expanded=false]))" },
  ],
});
