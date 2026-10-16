import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: multi",
  summary: "allowsMultipleExpanded (Angular multi) lets several disclosures stay expanded at once: opening one leaves the others as they are.",
  tags: ["cdk", "accordion"],
  status: "experimental",
  frame: { height: 210, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#color button", "aria-expanded", "false"] },
    { click: "#color button" },
    { attr: ["#color button", "aria-expanded", "true"] },
    { click: "#size button" },
    { attr: ["#size button", "aria-expanded", "true"] },
    { attr: ["#color button", "aria-expanded", "true"] },
    { attr: ["#color [role=group]", "hidden", null] },
    { attr: ["#size [role=group]", "hidden", null] },
    { click: "#color button" },
    { attr: ["#color button", "aria-expanded", "false"] },
    { attr: ["#size button", "aria-expanded", "true"] },
  ],
});
