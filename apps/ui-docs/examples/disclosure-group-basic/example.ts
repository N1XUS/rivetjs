import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DisclosureGroup: Usage",
  summary: 'DisclosureGroup demo "Usage".',
  tags: ["disclosure-group"],
  status: "experimental",
  frame: { height: 549, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=disclosure]:nth-of-type(1) [slot=trigger][aria-expanded=true]" },
    { click: "[data-slot=disclosure]:nth-of-type(2) [slot=trigger]" },
    { matches: "[data-slot=disclosure]:nth-of-type(2) [slot=trigger][aria-expanded=true]" },
    { matches: "[data-slot=disclosure]:nth-of-type(1) [slot=trigger][aria-expanded=false]" },
    { expect: ["[data-slot=disclosure]:nth-of-type(2) [data-slot=disclosure-body]", "Available on iOS and Android devices."] },
  ],
});
