import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Portal behind a signal",
  summary:
    "A notice rendered with <Portal> from @rivetjs/cdk/portal at the end of body, outside a clipped card; created when a signal turns true, removed with it.",
  tags: ["portal", "overlay"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: "[data-rivet-portal]" },
    { attr: ["#show", "aria-expanded", "false"] },
    { press: ["#show", "Enter"] },
    { matches: "body > [data-rivet-portal] > #notice" },
    { absent: "#card #notice" },
    { attr: ["#show", "aria-expanded", "true"] },
    { expect: ["#notice", "Rendered at the end of body."] },
    { click: "#dismiss" },
    { absent: "[data-rivet-portal]" },
    { attr: ["#show", "aria-expanded", "false"] },
    { click: "#show" },
    { matches: "body > [data-rivet-portal] > #notice" },
  ],
});
