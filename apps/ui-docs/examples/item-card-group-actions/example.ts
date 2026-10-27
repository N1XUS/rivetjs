import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Actions",
  summary:
    "ItemCardGroupCollection onAction makes every card a row with an action (press, Enter): here it plays the episode, isCurrent marks the playing one (aria-current), and a ToggleButton in ItemCard.Action stays its own tab stop.",
  tags: ["item-card-group", "grid-list", "toggle-button"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['#icg-episodes [data-key="e1"]', "aria-current", "true"] },
    { click: '#icg-episodes [data-key="e2"]' },
    { attr: ['#icg-episodes [data-key="e2"]', "aria-current", "true"] },
    { attr: ['#icg-episodes [data-key="e1"]', "aria-current", null] },
    { expect: ["#icg-playing", "Night shift at the bakery"] },
    { key: "ArrowDown" },
    { key: "Enter" },
    { expect: ["#icg-playing", "The last lighthouse keeper"] },
    { click: "#icg-save-e1" },
    { attr: ["#icg-save-e1", "aria-pressed", "true"] },
    { expect: ["#icg-playing", "The last lighthouse keeper"] },
  ],
});
