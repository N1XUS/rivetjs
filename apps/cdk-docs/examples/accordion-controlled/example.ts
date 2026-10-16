import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: controlled",
  summary: "expandedKeys as a two-way Signal on DisclosureGroup and isExpanded as a two-way Signal on a standalone Disclosure, both set from outside.",
  tags: ["cdk", "accordion", "signals"],
  status: "experimental",
  frame: { height: 275, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#value", "expanded: profile; notes: false"] },
    { attr: ["#profile button", "aria-expanded", "true"] },
    { click: "#profile button" },
    { attr: ["#profile button", "aria-expanded", "false"] },
    { expect: ["#value", "expanded: none"] },
    { click: "#open-privacy" },
    { attr: ["#privacy button", "aria-expanded", "true"] },
    { expect: ["#value", "expanded: privacy"] },
    { click: "#close-all" },
    { attr: ["#privacy button", "aria-expanded", "false"] },
    { click: "#toggle-notes" },
    { attr: ["#notes button", "aria-expanded", "true"] },
    { click: "#notes button" },
    { expect: ["#value", "notes: false"] },
  ],
});
