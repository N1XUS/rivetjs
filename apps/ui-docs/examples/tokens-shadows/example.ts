import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tokens: shadows",
  summary:
    "The three theme shadow tokens (field, surface, overlay) in the current theme and on a light sample, the elevation ladder (none → field → surface → overlay), stacked layers (Card over the page, Popover over a Card, Modal over everything) and a custom shadow token. In dark mode the Rivet theme replaces drop shadows with 1 px inset hairlines (the default theme: none on surfaces, a faint inset glow on overlays). Values are read from the live CSS and follow the theme toggle.",
  tags: ["tokens", "shadows", "elevation", "theme"],
  status: "experimental",
  frame: { height: 1100, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "[data-token='--surface-shadow']" },
    { expect: ["[data-value='--overlay-shadow']", "px"] },
    { expect: ["[data-value='light--surface-shadow']", "px"] },
    { expect: ["[data-value='ladder3']", "px"] },
    { expect: ["[data-value='--raised-shadow']", "px"] },
  ],
});
