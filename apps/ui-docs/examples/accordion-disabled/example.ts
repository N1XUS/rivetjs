import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: Disabled State",
  summary: 'Accordion demo "Disabled State".',
  tags: ["accordion"],
  status: "experimental",
  frame: { height: 396, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".accordion[data-disabled] [data-slot=accordion-item]:nth-of-type(1) [data-slot=accordion-trigger][data-disabled]" },
    { matches: "[data-slot=accordion-item]:nth-of-type(2) [data-slot=accordion-trigger][data-disabled]" },
    { click: "div.space-y-2:nth-of-type(2) [data-slot=accordion-item]:nth-of-type(1) [data-slot=accordion-trigger]" },
    { matches: "div.space-y-2:nth-of-type(2) [data-slot=accordion-item]:nth-of-type(1):is([open], :has([data-slot=accordion-trigger][aria-expanded=true]))" },
  ],
});
