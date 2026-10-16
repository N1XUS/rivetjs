import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: Controlled",
  summary: 'Accordion demo "Controlled".',
  tags: ["accordion"],
  status: "experimental",
  frame: { height: 308, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["strong", "getting-started"] },
    { matches: "[aria-label='Previous item'][disabled]" },
    { click: "[aria-label='Next item']" },
    { expect: ["strong", "core-concepts"] },
    { matches: "[data-slot=accordion-item]:nth-of-type(2) [data-slot=accordion-trigger][aria-expanded=true]" },
    { click: "[data-slot=accordion-item]:nth-of-type(2) [data-slot=accordion-trigger]" },
    { expect: ["strong", "none"] },
  ],
});
