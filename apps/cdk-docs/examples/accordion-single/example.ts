import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion",
  summary:
    "A single-expansion accordion (DisclosureGroup): opening one Disclosure closes the open one; the trigger Button and DisclosurePanel are wired by the Disclosure.",
  tags: ["cdk", "accordion"],
  status: "experimental",
  frame: { height: 224, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#shipping button", "aria-expanded", "true"] },
    { attr: ["#returns button", "aria-expanded", "false"] },
    { matches: "#returns [role=group][hidden]" },
    { matches: "#shipping.rv-Disclosure[data-expanded]" },
    { click: "#returns button" },
    { attr: ["#returns button", "aria-expanded", "true"] },
    { attr: ["#returns [role=group]", "hidden", null] },
    { attr: ["#shipping button", "aria-expanded", "false"] },
    { matches: "#returns[data-expanded]" },
    { matches: "#shipping:not([data-expanded])" },
    { press: ["#warranty button", "Enter"] },
    { attr: ["#warranty button", "aria-expanded", "true"] },
    { attr: ["#returns button", "aria-expanded", "false"] },
    { click: "#warranty button" },
    { attr: ["#warranty button", "aria-expanded", "false"] },
    { matches: "#warranty button svg.plus" },
  ],
});
