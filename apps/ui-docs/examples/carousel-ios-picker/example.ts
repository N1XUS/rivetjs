import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: iOS picker",
  summary: "embla's IOS Picker example on the ui Carousel: vertical drag-free carousels with embla's translate off, drawn as 3D wheels.",
  tags: ["carousel", "picker"],
  status: "experimental",
  frame: {
    height: "lg",
  },
  show: ["src/routes/index.tsx", "src/components/IosPickerItem.tsx", "src/styles.css"],
  test: [
    { attr: ["#carousel-ios-picker-hours", "data-ready", "true"] },
    { matches: '#carousel-ios-picker-hours-slide-0[style*="opacity: 1"]' },
    { matches: '#carousel-ios-picker-hours-viewport > div[style*="rotateX"]' },
    { attr: ["#carousel-ios-picker-minutes", "data-ready", "true"] },
  ],
});
