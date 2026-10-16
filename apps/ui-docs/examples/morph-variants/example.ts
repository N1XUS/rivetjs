import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Morph: Variants",
  summary: "primary inverts the surface (the theme's foreground is the paper); secondary uses the overlay surface and shadow.",
  tags: ["morph", "buttons"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#morph-variant-secondary", "class", "morph morph--top morph--secondary"] },
    { click: "#morph-variant-secondary-view" },
    { matches: "#morph-variant-secondary[data-open]" },
  ],
});
