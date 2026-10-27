import { defineExample } from "@rivetjs/docs-kit/define.ts";

const TRACK = (key: string) => `#album-tracks [data-key="${key}"]`;

export default defineExample({
  title: "Showcase: Music",
  summary:
    "A music player screen: a contained library Sidebar (icon rail, sheet on phones), an album row in a ScrollShadow of Cards, the album's tracks as an ItemCardGroupCollection (arrow keys, Enter plays, the playing row is current) with ToggleButton likes, and a player bar with play / pause, skip, shuffle, repeat, seek and volume sliders. Invented artists; no audio plays.",
  tags: ["showcase", "sidebar", "item-card-group", "scroll-shadow", "card", "slider", "toggle-button", "button", "image"],
  status: "experimental",
  frame: { height: 760 },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#album-page .album-title", "Low Tide Hours"] },
    { expect: ["#now-title", "Harbour Lights"] },
    { click: "#album-ember" },
    { attr: ["#album-ember", "aria-pressed", "true"] },
    { expect: ["#album-page .album-title", "Ember Season"] },
    { click: TRACK("ember-2") },
    { expect: ["#now-title", "After the Bonfire"] },
    { attr: [TRACK("ember-2"), "aria-current", "true"] },
    { expect: ["#player-status", "Playing After the Bonfire by The Quiet Arcades"] },
    { key: "ArrowDown" },
    { key: "Enter" },
    { expect: ["#now-title", "Warm Front"] },
    { click: "#play" },
    { expect: ["#player-status", "Paused"] },
    { click: "#like-ember-0" },
    { matches: "#like-ember-0[aria-pressed=true]" },
    { click: "#like-ember-0" },
    { absent: "#like-ember-0[aria-pressed=true]" },
    { click: "#album-low-tide" },
    { matches: "#like-low-tide-2[aria-pressed=true]" },
    { click: "#library-toggle" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
  ],
});
