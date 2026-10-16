import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disclosure: Render Function",
  summary: 'Disclosure demo "Render Function".',
  tags: ["disclosure"],
  status: "experimental",
  frame: { height: 440, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=disclosure][data-custom=foo]" },
    { matches: "[data-slot=disclosure-content][data-custom=bar]" },
    { matches: "[data-slot=disclosure-content][data-expanded=true]" },
    { click: "[slot=trigger]" },
    { absent: "[data-slot=disclosure-content][data-expanded=true]" },
    { click: "[slot=trigger]" },
    { expect: ["[data-slot=disclosure-body]", "Expo must be installed"] },
  ],
});
