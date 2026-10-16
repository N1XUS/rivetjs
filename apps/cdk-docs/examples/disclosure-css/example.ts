import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disclosure: CSS",
  summary: "Plain CSS on rv-Disclosure, rv-Button, rv-DisclosurePanel and [data-expanded] in a single-expansion DisclosureGroup.",
  tags: ["cdk", "disclosure", "css"],
  status: "experimental",
  frame: { height: 134, auto: true },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#returns.rv-Disclosure:not([data-expanded])" },
    { click: "#returns button" },
    { matches: "#returns[data-expanded]" },
    { attr: ["#returns button", "aria-expanded", "true"] },
    { click: "#shipping button" },
    { matches: "#shipping[data-expanded]" },
    { matches: "#returns:not([data-expanded])" },
  ],
});
