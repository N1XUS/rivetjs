import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: Render Function",
  summary: 'Accordion demo "Render Function".',
  tags: ["accordion"],
  status: "experimental",
  frame: { height: 360, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-custom=accordion][data-slot=accordion]" },
    { matches: "[data-custom=item][data-slot=accordion-item]" },
    { matches: "[data-custom=heading][data-slot=accordion-heading]" },
    { matches: "button[data-custom=trigger][data-slot=accordion-trigger]" },
    { matches: "[data-custom=panel][data-slot=accordion-panel]" },
    { click: "[data-custom=trigger]" },
    { matches: "[data-custom=trigger][aria-expanded=true]" },
  ],
});
