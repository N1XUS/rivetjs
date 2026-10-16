import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: Without Separator",
  summary: 'Accordion demo "Without Separator".',
  tags: ["accordion"],
  status: "experimental",
  frame: { height: 204, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=accordion-item][data-hide-separator=true]" },
    { click: "[data-slot=accordion-item]:nth-of-type(3) [data-slot=accordion-trigger]" },
    { matches: "[data-slot=accordion-item]:nth-of-type(3) [data-slot=accordion-trigger][aria-expanded=true]" },
  ],
});
