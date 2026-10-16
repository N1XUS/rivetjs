import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DisclosureGroup: Controlled",
  summary: 'DisclosureGroup demo "Controlled".',
  tags: ["disclosure-group"],
  status: "experimental",
  frame: { height: 605, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[aria-label='Previous disclosure'][disabled]" },
    { click: "[aria-label='Next disclosure']" },
    { matches: "[data-slot=disclosure]:nth-of-type(2) [slot=trigger][aria-expanded=true]" },
    { matches: "[aria-label='Next disclosure'][disabled]" },
    { click: "[aria-label='Previous disclosure']" },
    { matches: "[data-slot=disclosure]:nth-of-type(1) [slot=trigger][aria-expanded=true]" },
  ],
});
