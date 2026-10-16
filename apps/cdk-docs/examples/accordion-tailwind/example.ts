import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: Tailwind",
  summary: "Tailwind styling with data-expanded: on the Disclosure root, group-data-expanded: on the chevron and aria-expanded: on the trigger Button.",
  tags: ["cdk", "accordion", "tailwind"],
  status: "experimental",
  frame: { height: 164, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#plans:not([data-expanded])" },
    { click: "#plans button" },
    { matches: "#plans[data-expanded]" },
    { attr: ["#plans button", "aria-expanded", "true"] },
    { click: "#trial button" },
    { matches: "#trial[data-expanded]" },
    { matches: "#plans:not([data-expanded])" },
  ],
});
