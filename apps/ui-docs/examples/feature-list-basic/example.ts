import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FeatureList: Usage",
  summary: "Plan features with the default check icon, and perks with their own lucide icons in the accent colour.",
  tags: ["feature-list"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#plan-features [data-slot=feature-list-item]:first-child", "Unlimited products"] },
    { matches: "#shop-perks.feature-list--accent [data-slot=feature-list-item] svg[aria-hidden=true]" },
  ],
});
