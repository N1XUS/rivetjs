import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disclosure: Usage",
  summary: 'Disclosure demo "Usage".',
  tags: ["disclosure"],
  status: "experimental",
  frame: { height: 440, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=disclosure-content][data-expanded=true]" },
    { click: "[slot=trigger]" },
    { absent: "[data-slot=disclosure-content][data-expanded=true]" },
    { click: "[slot=trigger]" },
    { expect: ["[data-slot=disclosure-body]", "Expo must be installed"] },
  ],
});
