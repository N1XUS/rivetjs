import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: Wallet Card",
  summary: "Payment methods: card brand icon, masked number and expiry, the default one marked.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#ic-wallet", "ending 4242"],
    },
  ],
});
