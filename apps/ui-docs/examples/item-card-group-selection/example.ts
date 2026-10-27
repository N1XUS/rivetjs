import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Selection",
  summary:
    "ItemCardGroupCollection (the interactive group, a cdk GridList) with selectionMode: rows take focus with the arrow keys and select on press or Space. Single selection drives a detail line; multiple selection uses a Checkbox in the selection slot.",
  tags: ["item-card-group", "selection", "grid-list", "checkbox"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#icg-plan", "Studio"] },
    { click: '#icg-plans [data-key="team"]' },
    { attr: ['#icg-plans [data-key="team"]', "data-selected", "true"] },
    { expect: ["#icg-plan", "Team"] },
    { key: "ArrowDown" },
    { focused: '#icg-plans [data-key="enterprise"]' },
    { key: " " },
    { expect: ["#icg-plan", "Enterprise"] },
    { click: '#icg-addons [data-key="backup"]' },
    { click: '#icg-addons [data-key="sso"]' },
    { expect: ["#icg-addon-count", "2 add-ons"] },
    { matches: '#icg-addons [data-key="sso"] [data-slot=checkbox][data-selected=true]' },
  ],
});
