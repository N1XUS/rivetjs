import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Showcase: Music",
  summary:
    "A music player screen: library sidebar, a scrolling album row, an album track list with likes, and a player bar with play / pause, skip, shuffle, repeat, seek and volume sliders. Invented artists; no audio plays.",
  tags: ["showcase", "slider", "toggle-button", "button", "image"],
  status: "experimental",
  frame: { height: 760 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#album-page .album-title", "Low Tide Hours"] },
    { expect: ["#now-title", "Harbour Lights"] },
    { click: "#album-ember" },
    { expect: ["#album-page .album-title", "Ember Season"] },
    { click: "#track-ember-2" },
    { expect: ["#now-title", "After the Bonfire"] },
    { expect: ["#player-status", "Playing After the Bonfire by The Quiet Arcades"] },
    { click: "#next" },
    { expect: ["#now-title", "Warm Front"] },
    { click: "#play" },
    { expect: ["#player-status", "Paused"] },
    { click: "#like-ember-0" },
    { matches: "#like-ember-0[aria-pressed=true]" },
    { click: "#like-ember-0" },
    { absent: "#like-ember-0[aria-pressed=true]" },
    { click: "#album-low-tide" },
    { matches: "#like-low-tide-2[aria-pressed=true]" },
  ],
});
