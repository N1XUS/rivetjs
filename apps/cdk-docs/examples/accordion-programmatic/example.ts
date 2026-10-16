import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: open all / close all",
  summary:
    "A group state from createDisclosureGroupState passed to DisclosureGroup state: openAll works only with multiple expansion, closeAll always; both skip disabled disclosures.",
  tags: ["cdk", "accordion"],
  status: "experimental",
  frame: { height: 210, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#open-all" },
    { attr: ["#intro button", "aria-expanded", "false"] },
    { click: "#usage button" },
    { attr: ["#usage button", "aria-expanded", "true"] },
    { click: "#close-all" },
    { attr: ["#usage button", "aria-expanded", "false"] },
    { click: "#multi" },
    { click: "#open-all" },
    { attr: ["#intro button", "aria-expanded", "true"] },
    { attr: ["#usage button", "aria-expanded", "true"] },
    { attr: ["#advanced button", "aria-expanded", "false"] },
    { click: "#close-all" },
    { attr: ["#intro button", "aria-expanded", "false"] },
    { attr: ["#usage button", "aria-expanded", "false"] },
  ],
});
