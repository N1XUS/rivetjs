import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoloCard: Membership Card",
  summary: "A portrait membership card: club name, photo, name and tier, then the member number and expiry in three content bands.",
  tags: ["holo-card"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#hc-membership", "Jonah Reyes"],
    },
    {
      hover: "#hc-membership",
    },
    {
      attr: ["#hc-membership", "data-active", "true"],
    },
  ],
});
