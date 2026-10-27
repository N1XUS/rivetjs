import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCard: Indicator",
  summary:
    "ItemCard.Indicator is a slot: a Status dot by default, or any content (a Badge count, a lucide icon); the caller renders it while it applies and styles the title.",
  tags: ["item-card", "status", "badge"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#ic-indicator-dot [data-slot=item-card-indicator][role=img][aria-label=Unread] [data-slot=status].status--accent" },
    { expect: ["#ic-indicator-count [data-slot=item-card-indicator][aria-label='12 new'] [data-slot=badge]", "12"] },
    { matches: "#ic-indicator-icon [data-slot=item-card-indicator][role=img][aria-label=Pinned] svg" },
    { absent: "#ic-indicator-read [data-slot=item-card-indicator]" },
  ],
});
