import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: Custom Indicator",
  summary: 'Accordion demo "Custom Indicator".',
  tags: ["accordion"],
  status: "experimental",
  frame: { height: 204, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=accordion-item]:nth-of-type(1) [data-slot=accordion-trigger]" },
    { matches: "[data-slot=accordion-item]:nth-of-type(1) [data-slot=accordion-trigger][aria-expanded=true]" },
    { matches: "[data-slot=accordion-item]:nth-of-type(1) [data-slot=accordion-trigger] span[data-slot=accordion-indicator][data-expanded=true] svg" },
  ],
});
