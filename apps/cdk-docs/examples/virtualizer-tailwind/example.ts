import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: Tailwind",
  summary:
    "Tailwind classes on the scroller (class), on every view wrapper (itemClass, with data-rv-type variants) and on the row content (zebra rows from view().index).",
  tags: ["virtualizer", "tailwind", "styling"],
  status: "experimental",
  frame: { height: 334, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // `class` replaces the default rv-Virtualizer class; `itemClass` replaces rv-Virtualizer-item.
    { matches: "#tw-list.rounded-xl:not(.rv-Virtualizer)" },
    { matches: '#tw-list [data-rv-view="0"].transition-colors' },
    { matches: '#tw-list [data-rv-view="1"] > [data-odd="true"]' },
    { press: ["#tw-list", "ArrowDown"] },
    { expect: ["#tw-top", "40"] },
    { click: "#tw-list-bottom" },
    { matches: '#tw-list [data-rv-view="1999"] > [data-odd="true"]' },
  ],
});
