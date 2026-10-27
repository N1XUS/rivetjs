import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: Device List",
  summary: "Signed-in devices as item cards, with the current one marked and a sign-out action on the others.",
  tags: ["item-card"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#ic-devices", "This device"],
    },
  ],
});
