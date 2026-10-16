import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disclosure: Tailwind",
  summary: "class props with Tailwind data-expanded: and group-data-expanded: variants on Disclosure, the trigger Button and DisclosurePanel.",
  tags: ["cdk", "disclosure", "tailwind"],
  status: "experimental",
  frame: { height: 164, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#billing.group:not(.rv-Disclosure)" },
    { matches: "#billing button.flex" },
    { click: "#billing button" },
    { matches: "#billing[data-expanded]" },
    { click: "#cancel button" },
    { matches: "#cancel[data-expanded]" },
    { matches: "#billing:not([data-expanded])" },
  ],
});
