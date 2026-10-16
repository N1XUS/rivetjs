import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: CSS",
  summary: "Plain CSS on rv-DisclosureGroup, rv-Disclosure[data-expanded], the trigger rv-Button [aria-expanded] and rv-DisclosurePanel.",
  tags: ["cdk", "accordion", "css"],
  status: "experimental",
  frame: { height: 149, auto: true },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: ".rv-DisclosureGroup > .rv-Disclosure:not([data-expanded])" },
    { click: "#install button" },
    { matches: "#install.rv-Disclosure[data-expanded]" },
    { attr: ["#install [role=group]", "hidden", null] },
    { expect: ["#install [role=group]", "npm install"] },
  ],
});
