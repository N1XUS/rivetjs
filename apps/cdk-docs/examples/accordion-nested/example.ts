import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: nested",
  summary: "A DisclosureGroup inside a DisclosurePanel: inner disclosures belong to the inner group, so opening one does not close the outer disclosure.",
  tags: ["cdk", "accordion"],
  status: "experimental",
  frame: { height: 123, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#fruit > h3 button" },
    { attr: ["#fruit > h3 button", "aria-expanded", "true"] },
    { click: "#apple button" },
    { attr: ["#apple button", "aria-expanded", "true"] },
    { attr: ["#fruit > h3 button", "aria-expanded", "true"] },
    { click: "#pear button" },
    { attr: ["#pear button", "aria-expanded", "true"] },
    { attr: ["#apple button", "aria-expanded", "false"] },
    { attr: ["#fruit > h3 button", "aria-expanded", "true"] },
    { click: "#veg button" },
    { attr: ["#veg button", "aria-expanded", "true"] },
    { attr: ["#fruit > h3 button", "aria-expanded", "false"] },
    { attr: ["#pear button", "aria-expanded", "true"] },
  ],
});
