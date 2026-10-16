import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: disabled",
  summary: "isDisabled on a Disclosure (or on the DisclosureGroup) disables its trigger; data-disabled marks the root.",
  tags: ["cdk", "accordion"],
  status: "experimental",
  frame: { height: 226, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#billing button", "disabled", ""] },
    { attr: ["#account button", "disabled", null] },
    { matches: "#billing[data-disabled]" },
    { matches: "#all-disabled[data-disabled]" },
    { attr: ["#locked button", "disabled", ""] },
    { click: "#review button" },
    { attr: ["#review button", "aria-expanded", "true"] },
    { attr: ["#review [role=group]", "hidden", null] },
    { click: "#account button" },
    { attr: ["#account button", "aria-expanded", "true"] },
    { attr: ["#review button", "aria-expanded", "false"] },
    { attr: ["#billing button", "aria-expanded", "false"] },
  ],
});
