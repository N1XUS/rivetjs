import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: FAQ Layout",
  summary: 'Accordion demo "FAQ Layout".',
  tags: ["accordion"],
  status: "experimental",
  frame: { height: 556, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["h2", "Frequently Asked Questions"] },
    { click: "div:nth-of-type(3) > .accordion [data-slot=accordion-item]:nth-of-type(1) [data-slot=accordion-trigger]" },
    { matches: "div:nth-of-type(3) > .accordion [data-slot=accordion-item]:nth-of-type(1) [data-slot=accordion-trigger][aria-expanded=true]" },
  ],
});
