import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Wallet List",
  summary: "Payment methods in one group with a header and an add action.",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#icg-wallet", "Add payment method"],
    },
  ],
});
