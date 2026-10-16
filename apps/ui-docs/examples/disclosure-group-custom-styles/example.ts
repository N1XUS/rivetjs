import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DisclosureGroup: Custom Styles",
  summary: 'DisclosureGroup demo "Custom Styles".',
  tags: ["disclosure-group"],
  status: "experimental",
  frame: { height: 145, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".disclosure-group.rounded-xl" },
    { click: "[data-slot=disclosure]:nth-of-type(2) [slot=trigger]" },
    { expect: ["[data-slot=disclosure]:nth-of-type(2) [data-slot=disclosure-body]", "Reach us at help@acme.com"] },
    { click: "[data-slot=disclosure]:nth-of-type(1) [slot=trigger]" },
    { matches: "[data-slot=disclosure]:nth-of-type(2) [slot=trigger][aria-expanded=false]" },
  ],
});
