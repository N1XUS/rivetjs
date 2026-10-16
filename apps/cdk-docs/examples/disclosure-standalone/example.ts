import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disclosure: standalone",
  summary: "Disclosures outside a DisclosureGroup are independent: several can be open at once; defaultExpanded renders one open.",
  tags: ["cdk", "disclosure"],
  status: "experimental",
  frame: { height: 136, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#specs[data-expanded]" },
    { matches: "#box [role=group][hidden]" },
    { click: "#box button" },
    { matches: "#box[data-expanded]" },
    { attr: ["#box [role=group]", "hidden", null] },
    { matches: "#specs[data-expanded]" },
    { click: "#specs button" },
    { matches: "#specs:not([data-expanded])" },
    { matches: "#box[data-expanded]" },
  ],
});
