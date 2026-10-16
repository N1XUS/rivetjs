import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disclosure: group",
  summary: "A DisclosureGroup is an accordion: one Disclosure expanded at a time (allowsMultipleExpanded lifts it); defaultExpandedKeys renders one open.",
  tags: ["cdk", "disclosure"],
  status: "experimental",
  frame: { height: 182, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#what.rv-Disclosure[data-expanded]" },
    { matches: "#js:not([data-expanded])" },
    { matches: "#js > h3 > button.rv-Button" },
    { matches: "#js > .rv-DisclosurePanel[role=group]" },
    { press: ["#js button", "Enter"] },
    { matches: "#js[data-expanded]" },
    { matches: "#what:not([data-expanded])" },
    { key: "Space" },
    { matches: "#js:not([data-expanded])" },
    { click: "#find button" },
    { matches: "#find[data-expanded]" },
    { click: "#what button" },
    { matches: "#what[data-expanded]" },
    { matches: "#find:not([data-expanded])" },
  ],
});
