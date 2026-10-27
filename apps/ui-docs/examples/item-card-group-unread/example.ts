import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Unread state",
  summary:
    "An ItemCardGroupCollection from items: isUnread sets data-unread (bold title, ItemCard.Indicator dot), opening a row marks it read, renderEmptyState fills the group when the unread filter leaves nothing.",
  tags: ["item-card-group", "grid-list", "empty-state", "segment"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '#icg-inbox [data-key="n1"][data-unread]' },
    { click: '#icg-inbox [data-key="n1"]' },
    { absent: '#icg-inbox [data-key="n1"][data-unread]' },
    { click: "#icg-filter [role=radio]:nth-of-type(2)" },
    { absent: '#icg-inbox [data-key="n1"]' },
    { click: '#icg-inbox [data-key="n2"]' },
    { expect: ["#icg-inbox", "All caught up"] },
  ],
});
