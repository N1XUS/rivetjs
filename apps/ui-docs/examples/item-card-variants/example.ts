import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: Variants",
  summary: "Five surfaces: default (raised), secondary, tertiary, outline and transparent.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 460 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#ic-variants .item-card--outline",
    },
  ],
});
