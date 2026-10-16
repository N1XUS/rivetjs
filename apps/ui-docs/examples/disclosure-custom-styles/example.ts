import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disclosure: Custom Styles",
  summary: 'Disclosure demo "Custom Styles".',
  tags: ["disclosure"],
  status: "experimental",
  frame: { height: 84, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: "[data-slot=disclosure-content][data-expanded=true]" },
    { click: "[slot=trigger]" },
    { matches: "[data-slot=disclosure-content][data-expanded=true]" },
    { expect: ["[data-slot=disclosure-body]", "Orders ship within 2 business days"] },
  ],
});
