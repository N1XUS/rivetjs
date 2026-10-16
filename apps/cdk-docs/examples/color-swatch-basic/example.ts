import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatch",
  summary:
    "ColorSwatch previews a color with a localized name (role img); colorName overrides it, aria-label adds context, and a render function child reads the color.",
  tags: ["color-swatch", "render-props", "tailwind"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#sw-red", "aria-label", "vibrant red"] },
    { attr: ["#sw-red", "aria-roledescription", "color swatch"] },
    { attr: ["#sw-named", "aria-label", "Fire truck red"] },
    { attr: ["#sw-labelled", "aria-label", "dark vibrant blue, Background"] },
    { attr: ["#sw-alpha", "aria-label", "very light vibrant green, 50% transparent"] },
    { expect: ["#sw-hex", "#7F007F"] },
  ],
});
