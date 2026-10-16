import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Theme swap",
  summary:
    "Four cards from the showcases (music, storefront, AI chat, settings) and one preset switch: Rivet, Classic, Brutalist, Glass and Mauve re-skin everything by changing one attribute (data-ui-preset); the markup never changes. Edit theme opens the preset in the theme builder.",
  tags: ["theme", "showcase", "segment", "card"],
  status: "experimental",
  frame: { height: 640, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#theme-swap", "data-ui-preset", "rivet"] },
    { attr: ["#ts-edit", "href", "/themes/"] },
    { click: "[data-testid=ts-preset-brutalist]" },
    { attr: ["#theme-swap", "data-ui-preset", "brutalist"] },
    { attr: ["#ts-edit", "href", "/themes/?lightness=0.52&chroma=0.22&hue=30&base=0&radius=none&formRadius=none"] },
    { click: "[data-testid=ts-preset-glass]" },
    { attr: ["#theme-swap", "data-ui-preset", "glass"] },
    { click: "#ts-add" },
    { expect: ["#ts-add", "In bag"] },
    { click: "#ts-play" },
    { attr: ["#ts-play", "aria-label", "Pause"] },
  ],
});
